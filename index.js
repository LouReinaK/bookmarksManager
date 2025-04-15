const APP_KEY = '032pg35p3awd4o9'; // Remplace par ta clé d'application
let FILE_PATH = "/bookmarksForDev.json"; // Remplace par le chemin vers ton fichier json
const url = new URL(window.location.href);
const REDIRECT_URI = url.origin + url.pathname;
const DEBUG = false; // Set to true while debugging
let dbx;
let accessToken;
let jsonData; // sert de buffer pour le fichier json
let versionHist; // stocke 5 versions précédentes de jsonData dans le session storage
let commandsHideState = true;

// Fonction pour authentifier l'utilisateur via OAuth
function authenticate() {
  // Créer l'URL d'authentification OAuth pour Dropbox
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  window.location.href = authUrl;  // Redirige l'utilisateur vers l'URL d'authentification
}

// Vérifier l'URL de redirection après l'authentification pour récupérer le token d'accès
function checkAuthentication() {
  // if there is anything in the local storage show it
  readFromLocalStorage();

  // then check the away storage anyway
  const urlParams = new URLSearchParams(window.location.hash.substring(1)); // Après le # dans l'URL
  accessToken = urlParams.get('access_token');
  if (!accessToken) accessToken = localStorage.getItem("accessToken"); // s'il n'y a pas d'access token dans l'url, regarde dans le stockage local

  if (accessToken) {
    try {
    localStorage.setItem("accessToken", accessToken); // enregistre l'access token dans le stockage local pour d'autres occurrences de la page : permet de réduire le nombre d'appels à l'oauth de dropbox qui est limité
    dbx = new Dropbox.Dropbox({ accessToken: accessToken });
    readJsonFile();
    } catch(e) {
      console.error("Failed to access the Dropbow serveur");
      alert("Echec de la synchronisation avec le serveur");
    }
  }
  else {
    authenticate();
  }
};

// écrit les données de jsonData dans le localStorage
function writeInLocalStorage() {
  localStorage.setItem("jsonData", JSON.stringify(jsonData, null, 2));
}

// ajoute les données de jsonData dans l'historique stocké dans le session storage
function writeInHistory() {
  if (DEBUG) console.log("json file saved in session history : ", jsonData);
  versionHist.push(structuredClone(jsonData));
  sessionStorage.setItem("versionHist", versionHist);
}

function readFromLocalStorage() {
  try {
    jsonData = JSON.parse(localStorage.getItem("jsonData"));
    if (jsonData === null) return;
    if (DEBUG) {
      console.log("json file read from local storage :", jsonData);
    }
  } catch (err) {
    console.error("error parsing json file read from local storage :", err.message);
    alert("Echec de la synchronisation avec le serveur");
  }
  // traitement
  let username = "";
  jsonData.forEach((element) => { if (element.id == -1) username = element.name; });
  document.getElementById("pageTitle").textContent = "Bonjour " + username;
  updateDisplay();
}

// Lire le fichier JSON depuis Dropbox
// extrait le nom de l'utilisateur
// update l'affichage
// enregistre le fichier JSON dans localStorage
function readJsonFile() {
  dbx.filesDownload({ path: FILE_PATH })
    .then(function (response) {
      response.result.fileBlob.text().then(function (fileContents) {
        try {
          jsonData = JSON.parse(fileContents);
          if (DEBUG) {
            console.log("json file read from Dropbox :", jsonData);
          }
        } catch (err) {
          console.error("error parsing json file read from Dropbox :", err.message);
        }
        // traitement
        let username = "";
        jsonData.forEach((element) => { if (element.id == -1) username = element.name; });
        document.getElementById("pageTitle").textContent = "Bonjour " + username;
        updateDisplay();
        writeInLocalStorage();
      });
    })
    .catch(function (error) {
      if (error.status === 401) {
        console.warn("the Dropbox access token has expired");
        authenticate();
      }
      else if (error.status === 409) {
        console.error("the file does not exist on Dropbox");
      } else {
        console.error('error reading json file from Dropbox :', error);
      }
    });
}

// Envoyer le fichier JSON à Dropbox
function writeJsonFile() {
  if (DEBUG) {
    console.log("json file to write to Dropbox :", jsonData);
  }
  fileContent = JSON.stringify(jsonData, null, 2);
  dbx.filesUpload({
    path: FILE_PATH,
    contents: fileContent,
    mode: { '.tag': 'overwrite' }
  })
    .then(function (response) {
      if (DEBUG) {
        console.log('json file successfully updated on Dropbox !');
      }
    })
    .catch(function (error) {
      if (error.status === 401) {
        console.warn("the Dropbox access token has expired");
        authenticate();
      }
      else {
        console.error('error writing json file to Dropbox :', error);
        if (error.status === 429); // too many requests, se mettra à jour plus tard
        else alert("Echec de la synchronisation avec le serveur");
      }
    });
}

function showNewBookmarkForm() {
  document.getElementById("bookmarkForm").style.display = "flex";
  document.getElementById("submitBookmarkForm").textContent = "Créer";
  document.getElementById("submitBookmarkForm").addEventListener("click", addBookmark);
  document.addEventListener("keydown", handleEnterIsCreate);
  document.addEventListener("keydown", handleEscape);
}

function showModificationForm(elem) {
  document.getElementById("nameInput").value = elem.parentNode.parentNode.querySelector(":scope .cardTitle").textContent;
  document.getElementById("urlInput").value = elem.parentNode.parentNode.querySelector(":scope .card").href;
  document.getElementById("bookmarkForm").style.display = "flex";
  document.getElementById("submitBookmarkForm").textContent = "Modifier";
  document.getElementById("bookmarkForm").dataset.targetBookmark = elem.dataset.bookmarkId;;
  document.getElementById("submitBookmarkForm").addEventListener("click", modifyBookmark);
  document.addEventListener("keydown", handleEnterIsModify);
  document.addEventListener("keydown", handleEscape);
}

function hideBookmarkForm() {
  document.getElementById("nameInput").value = "";
  document.getElementById("urlInput").value = "";
  document.getElementById("bookmarkForm").style.display = "none";
  document.getElementById("submitBookmarkForm").removeEventListener("click", addBookmark);
  document.getElementById("submitBookmarkForm").removeEventListener("click", modifyBookmark);
  document.removeEventListener("keydown", handleEnterIsCreate);
  document.removeEventListener("keydown", handleEnterIsModify);
  document.removeEventListener("keydown", handleEscape);
}

// on submitting the form, add the bookmark to the buffer then update the display and the JSON file
function addBookmark() {
  {
    // ajoute la version actuelle de jsonData à l'historique avant de la modifier
    writeInHistory();
    try {
      document.removeEventListener("keydown",handleEnterIsCreate);
      const name = document.getElementById("nameInput").value;
      const url = document.getElementById("urlInput").value;
      const id = calculateNewId();
      const newObject = {
        "id": id,
        "name": name,
        "url": url
      }
      jsonData.push(newObject);
    } catch (e) {
      // jsonData n'a pas été modifié, on annule son ajout à l'historique des versions
      versionHist.pop();
    }
    if(DEBUG) {
      console.log("file modified in buffer :", jsonData);
    }
    hideBookmarkForm();
    // hideCommands();
    updateDisplay();
    writeInLocalStorage();
    writeJsonFile();
}

// Supprimer un élément du buffer
function removeBookmark(id) {
  for (let index in jsonData) {
    if (jsonData[index].id == id) {
      // ajoute la version actuelle de jsonData à l'historique avant de la modifier
      console.log(jsonData);
      writeInHistory();
      try {
        jsonData.splice(index, 1);
      } catch (e) {
        // jsonData n'a pas été modifié, on annule son ajout à l'historique des versions
        versionHist.pop();
      }
      if (DEBUG) {
        console.log("element removed from buffer :", jsonData);
      }
      updateDisplay();
      writeInLocalStorage();
      writeJsonFile();
      console.log(versionHist.stack[versionHist.stack.length - 1]);
      return 1;
    }
  }
  if (DEBUG) {
    console.log("element missing from json file");
  }
  return 0;
}

// Modifier un élément du buffer sur la validation du form
function modifyBookmark() {
  const id = document.getElementById("bookmarkForm").dataset.targetBookmark;
  const name = document.getElementById("nameInput").value;
  const url = document.getElementById("urlInput").value;
  // ajoute la version actuelle de jsonData à l'historique avant de la modifier
  writeInHistory();
  try {
    jsonData.forEach((element) => {
      if (element.id == id) {
        element.name = name;
        element.url = url;
      }
    });
  } catch (e) {
    // jsonData n'a pas été modifié, on annule son ajout à l'historique des versions
    versionHist.pop();
  }
  if (DEBUG) {
    console.log("element modified in buffer :", jsonData);
  }
  hideBookmarkForm();
  updateDisplay();
  writeInLocalStorage();
  writeJsonFile();
}

function moveBookmarkLeft(id) {
  writeInHistory();
  try {
    let elementToMove;
    jsonData.forEach((elem) => { if (elem.id == id) elementToMove = elem });
    const index = jsonData.indexOf(elementToMove);
    if (index > 1) { // reminder : the first element is the owner's name
      jsonData[index] = jsonData[index - 1];
      jsonData[index - 1] = elementToMove;
      updateDisplay();
      writeInLocalStorage();
      writeJsonFile();
    }
  } catch (e) {
    // si la modification de jsonData a échoué, on retire la version sauvegardée
    versionHist.pop();
  }
}

function moveBookmarkRight(id) {
  writeInHistory();
  try {
    let elementToMove;
    jsonData.forEach((elem) => { if (elem.id == id) elementToMove = elem });
    const index = jsonData.indexOf(elementToMove);
    if (index < jsonData.length - 1) {
      jsonData[index] = jsonData[index + 1];
      jsonData[index + 1] = elementToMove;
      updateDisplay();
      writeInLocalStorage();
      writeJsonFile();
    }
  } catch (e) {
    // si la modification de jsonData a échoué, on retire la version sauvegardée
    versionHist.pop();
  }
}

function showCommands() {
  Array.prototype.slice.call(document.getElementsByClassName("actionButton")).forEach((elem) => {
    elem.style.top = "0";
  });
  commandsHideState = false;
  document.getElementById("editBookmarksBtn").textContent = "Done";
  document.getElementById("editBookmarksBtn").removeEventListener("click", showCommands);
  document.getElementById("editBookmarksBtn").addEventListener("click", hideCommands);
}

function hideCommands() {
  Array.from(document.getElementsByClassName("actionButton")).forEach((elem) => {elem.style.top = "-40px";});
  commandsHideState = true;
  document.getElementById("editBookmarksBtn").textContent = "Edit";
  document.getElementById("editBookmarksBtn").removeEventListener("click", hideCommands);
  document.getElementById("editBookmarksBtn").addEventListener("click", showCommands);
}

function restoreLastVersion() {
  let previousVersion = versionHist.pop();
  if (previousVersion !== undefined) {
    console.log("json file version to be restored : ", previousVersion);
    jsonData = previousVersion;
    sessionStorage.setItem("versionHist", versionHist);
    updateDisplay();
    writeInLocalStorage();
    writeJsonFile();
  } else {
    console.log("no version to restore")
  }
}

// Retourne un id correspondant au premier entier non utilisé
function calculateNewId() {
  let id = 0;
  while (true) {
    let unique = true;
    for (let i in jsonData) {
      const object = jsonData[i];
      if (id == object.id) {
        unique = false;
        break;
      }
    }
    if (unique) return id;
    else id++;
  }
}

function updateDisplay() {
  let htmlContent = "";
  jsonData.forEach((bookmark) => { htmlContent += createCard(bookmark) });
  htmlContent += `<div class="cardWrapper">
                      <button class="card" id="addNewBookmarkButton">
                          <span class="cardTitle">+</span>
                      </button>
                  </div>`
  document.getElementById('bookmarksContainer').innerHTML = htmlContent;

  if (commandsHideState) {
    // Cacher les commandes des marques pages
    hideCommands();
  } else {
    // Afficher les commandes
    showCommands();
  }

  // ajouter les événements aux éléments raffraîchis
  document.getElementById('addNewBookmarkButton').addEventListener('click', showNewBookmarkForm);
  Array.prototype.slice.call(document.getElementsByClassName('removeCardBtn')).forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const btn = event.target.closest('.removeCardBtn');
      if (btn) removeBookmark(btn.dataset.bookmarkId);
    })
  });
  Array.prototype.slice.call(document.getElementsByClassName('modifyCardBtn')).forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const btn = event.target.closest('.modifyCardBtn');
      if(btn) showModificationForm(btn);
    })
  });
  Array.prototype.slice.call(document.getElementsByClassName('moveCardLeftBtn')).forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const btn = event.target.closest('.moveCardLeftBtn');
      if(btn) moveBookmarkLeft(btn.dataset.bookmarkId);
    })
  });
  Array.prototype.slice.call(document.getElementsByClassName('moveCardRightBtn')).forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const btn = event.target.closest('.moveCardRightBtn');
      if(btn) moveBookmarkRight(btn.dataset.bookmarkId);
    })
  });
}

// generates HTML content to create a card with the data of a bookmark
function createCard(element) {
  try {
    if (element.id == -1) return ""; // il s'agit du nom du propriétaire du fichier
    const leftIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32C28.7 32 0 60.7 0 96L0 416zM128 256c0-6.7 2.8-13 7.7-17.6l112-104c7-6.5 17.2-8.2 25.9-4.4s14.4 12.5 14.4 22l0 208c0 9.5-5.7 18.2-14.4 22s-18.9 2.1-25.9-4.4l-112-104c-4.9-4.5-7.7-10.9-7.7-17.6z"/></svg>`;
    const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160L0 416c0 53 43 96 96 96l256 0c53 0 96-43 96-96l0-96c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7-14.3 32-32 32L96 448c-17.7 0-32-14.3-32-32l0-256c0-17.7 14.3-32 32-32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L96 64z"/></svg>`;
    const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>`;
    const rightIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M448 96c0-35.3-28.7-64-64-64L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320zM320 256c0 6.7-2.8 13-7.7 17.6l-112 104c-7 6.5-17.2 8.2-25.9 4.4s-14.4-12.5-14.4-22l0-208c0-9.5 5.7-18.2 14.4-22s18.9-2.1 25.9 4.4l112 104c4.9 4.5 7.7 10.9 7.7 17.6z"/></svg>`;    
    return `<div class="cardWrapper">
              <a class="card" href="${element.url}">
                  <span class="cardTitle">${element.name}</span>
              </a>
              <div class="bookmarkActionsContainer">
                  <button class="actionButton moveCardLeftBtn" data-bookmark-id="${element.id}">${leftIcon}</button>
                  <button class="actionButton modifyCardBtn" data-bookmark-id="${element.id}">${editIcon}</button>
                  <button class="actionButton removeCardBtn" data-bookmark-id="${element.id}">${deleteIcon}</button>
                  <button class="actionButton moveCardRightBtn" data-bookmark-id="${element.id}">${rightIcon}</button>
              </div>
            </div>`
  } catch (e) {
    console.error(`error creating HTML card with ${element} : `, e);
    return "";
  }
}

const handleEnterIsCreate = (event) => {
  if (event.key == "Enter") addBookmark();
}

const handleEnterIsModify = (event) => {
  if (event.key == "Enter") modifyBookmark();
}

const handleEscape = (event) => {
  if (event.key == "Escape") hideBookmarkForm();
}

// fonction appelée une seule fois au chargement de la page
function init() {
  // récupérer les données de jsonDataHist dans le session storage :
  versionHist = sessionStorage.getItem("jsonDataHist");
  if (versionHist === null) versionHist = new CircularFixedStack(5);

  // Vérifier si l'utilisateur est déjà authentifié
  checkAuthentication();

  // Ajout des événements
  document.getElementById("editBookmarksBtn").addEventListener("click", showCommands);
  document.getElementById("cancelChangesBtn").addEventListener("click", restoreLastVersion);
  document.getElementById("closeBookmarkFormBtn").addEventListener("click", hideBookmarkForm);

  // Permettre de sélectionner tout le contenu des input au click
  // credit : chatgpt gg à lui
  let focusedElement;
  document.addEventListener('focus', function (event) {
    const target = event.target;
    if (target.tagName === 'INPUT') {
      if (focusedElement === target) return;
      focusedElement = target;
      setTimeout(function () {
        focusedElement.select();
      }, 100);
    }
  }, true);
  document.getElementById("closeBookmarkFormBtn").addEventListener("click", () => { focusedElement = undefined });
  document.getElementById("submitBookmarkForm").addEventListener("click", () => { focusedElement = undefined });
  document.addEventListener("keydown", (event) => {
    if (event.key == "Escape") focusedElement = undefined;
    if (event.key == "Enter") focusedElement = undefined;
  });
}

document.addEventListener('DOMContentLoaded', init);