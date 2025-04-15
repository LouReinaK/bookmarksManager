const APP_KEY = '032pg35p3awd4o9'; // Remplace par ta clé d'application
let FILE_PATH = "/bookmarksForDev.json"; // Remplace par le chemin vers ton fichier json
const url = new URL(window.location.href);
const REDIRECT_URI = url.origin + url.pathname;
const DEBUG = true; // Set to true while debugging
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
      document.removeEventListener("keydown", (event) => { if (event.key == "Enter") addBookmark(); });
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
  }
  if (DEBUG) {
    console.log("element added to buffer :", jsonData);
  }
  hideBookmarkForm();
  hideCommands(); // au cas où les commandes étaient toujours affichées
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

// Modifier un élément du buffer
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
  Array.prototype.slice.call(document.getElementsByClassName("bookmarkActionsContainer")).forEach((elem) => { elem.style.display = "flex"; });
  commandsHideState = false;
  document.getElementById("editBookmarksBtn").textContent = "Done";
  document.getElementById("editBookmarksBtn").removeEventListener("click", showCommands);
  document.getElementById("editBookmarksBtn").addEventListener("click", hideCommands);
}

function hideCommands() {
  Array.prototype.slice.call(document.getElementsByClassName("bookmarkActionsContainer")).forEach((elem) => { elem.style.display = "none"; });
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
    // cacher les commandes des marques pages
    Array.prototype.slice.call(document.getElementsByClassName("bookmarkActionsContainer")).forEach((elem) => { elem.style.display = "none"; });
  }

  // ajouter les événements aux éléments raffraîchis
  document.getElementById('addNewBookmarkButton').addEventListener('click', showNewBookmarkForm);
  Array.prototype.slice.call(document.getElementsByClassName('removeCardBtn')).forEach((btn) => { btn.addEventListener('click', (event) => { removeBookmark(event.target.dataset.bookmarkId) }) });
  Array.prototype.slice.call(document.getElementsByClassName('modifyCardBtn')).forEach((btn) => { btn.addEventListener('click', (event) => { showModificationForm(event.target) }) });
  Array.prototype.slice.call(document.getElementsByClassName('moveCardLeftBtn')).forEach((btn) => { btn.addEventListener('click', (event) => { moveBookmarkLeft(event.target.dataset.bookmarkId) }) });
  Array.prototype.slice.call(document.getElementsByClassName('moveCardRightBtn')).forEach((btn) => { btn.addEventListener('click', (event) => { moveBookmarkRight(event.target.dataset.bookmarkId) }) });
}

// generates HTML content to create a card with the data of a bookmark
function createCard(element) {
  try {
    if (element.id == -1) return ""; // il s'agit du nom du propriétaire du fichier
    return `<div class="cardWrapper">
              <a class="card" href="${element.url}">
                  <span class="cardTitle">${element.name}</span>
              </a>
              <div class="bookmarkActionsContainer">
                  <button class="moveCardLeftBtn" data-bookmark-id="${element.id}"><</button>
                  <button class="modifyCardBtn" data-bookmark-id="${element.id}">🖌️</button>
                  <button class="removeCardBtn" data-bookmark-id="${element.id}">🚮</button>
                  <button class="moveCardRightBtn" data-bookmark-id="${element.id}">></button>
              </div>
            </div>`
  } catch (e) {
    console.err.log(`error creating HTML card with ${element} : `, e);
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