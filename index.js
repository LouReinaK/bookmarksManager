const APP_KEY = '032pg35p3awd4o9'; // Remplace par ta clé d'application
let FILE_PATH = "/bookmarks.json"; // Remplace par le chemin vers ton fichier json
const url = new URL(window.location.href);
const REDIRECT_URI = url.origin + url.pathname;
const DEBUG = true; // Set to true while debugging
let dbx;
let accessToken;
let jsonData; // sert de buffer pour le fichier json
let commandsHideState = true;

// Fonction pour authentifier l'utilisateur via OAuth
function authenticate() {
  // Créer l'URL d'authentification OAuth pour Dropbox
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  window.location.href = authUrl;  // Redirige l'utilisateur vers l'URL d'authentification
  
}

// Vérifier l'URL de redirection après l'authentification pour récupérer le token d'accès
function checkAuthentication() {
  const urlParams = new URLSearchParams(window.location.hash.substring(1)); // Après le # dans l'URL
  accessToken = urlParams.get('access_token');

  if (accessToken) {
    dbx = new Dropbox.Dropbox({ accessToken: accessToken });
    readFromLocalStorage();
    readJsonFile();
  }
  else {
    authenticate();
  }
};

function writeInLocalStorage() {
  localStorage.setItem("jsonData", JSON.stringify(jsonData, null, 2));
}

function readFromLocalStorage() {
  try {
    jsonData = JSON.parse(localStorage.getItem("jsonData"));
    if(jsonData === null) return;
    if(DEBUG) {
      console.log("file read from local storage :", jsonData);
    }
  } catch (err) {
    console.error("Erreur de parsing JSON :", err.message);
  }
  // traitement
  let username = "";
  jsonData.forEach((element) => {if(element.id == -1) username = element.name;});
  document.getElementById("pageTitle").textContent = "Bonjour " + username;
  updateDisplay();
}

// Lire le fichier JSON depuis Dropbox
function readJsonFile() {
  dbx.filesDownload({ path: FILE_PATH })
    .then(function (response) {
      response.result.fileBlob.text().then(function (fileContents) {
        try {
          jsonData = JSON.parse(fileContents);
          if(DEBUG) {
            console.log("file read :", jsonData);
          }
        } catch (err) {
          console.error("Erreur de parsing JSON :", err.message);
        }
        // traitement
        let username = "";
        jsonData.forEach((element) => {if(element.id == -1) username = element.name;});
        document.getElementById("pageTitle").textContent = "Bonjour " + username;
        updateDisplay();
        writeInLocalStorage();
      });
    })
    .catch(function (error) {
      if (error.status === 401) {
        console.warn("La clé d'accès a expiré");
        authenticate();
      }
      else if (error.status === 409) {
        console.error('Le fichier n\'existe pas sur Dropbox.');
      } else {
        console.error('Erreur lors de la lecture du fichier :', error);
      }
    });
}

// Envoyer le fichier JSON à Dropbox
function writeJsonFile() {
  if(DEBUG) {
    console.log("file to write :", jsonData);
  }
  fileContent = JSON.stringify(jsonData, null, 2);
  dbx.filesUpload({
    path: FILE_PATH,
    contents: fileContent,
    mode: { '.tag': 'overwrite' }
  })
    .then(function (response) {
      if(DEBUG) {
        console.log('File successfully updated !');
      }
    })
    .catch(function (error) {
      if (error.status === 401) {
        console.warn("La clé d'accès a expiré");
        authenticate();
      }
      else {
        console.error('Erreur lors de la mise à jour du fichier :', error);
      }
    });
}

function showNewBookmarkForm() {
  document.getElementById("bookmarkForm").style.display = "flex";
  document.getElementById("submitBookmarkForm").textContent = "Créer";
  document.getElementById("submitBookmarkForm").addEventListener("click", addBookmark);
  document.addEventListener("keydown",handleEnterIsCreate);
  document.addEventListener("keydown",handleEscape);
}

function showModificationForm(elem) {
  document.getElementById("nameInput").value = elem.parentNode.parentNode.querySelector(":scope .cardTitle").textContent;
  document.getElementById("urlInput").value = elem.parentNode.parentNode.querySelector(":scope .card").href;
  document.getElementById("bookmarkForm").style.display = "flex";
  document.getElementById("submitBookmarkForm").textContent = "Modifier";
  document.getElementById("bookmarkForm").dataset.targetBookmark = elem.dataset.bookmarkId;;
  document.getElementById("submitBookmarkForm").addEventListener("click", modifyBookmark);
  document.addEventListener("keydown",handleEnterIsModify);
  document.addEventListener("keydown",handleEscape);
}

function hideBookmarkForm() {
  document.getElementById("nameInput").value = "";
  document.getElementById("urlInput").value = "";
  document.getElementById("bookmarkForm").style.display = "none";
  document.getElementById("submitBookmarkForm").removeEventListener("click", addBookmark);
  document.getElementById("submitBookmarkForm").removeEventListener("click", modifyBookmark);
  document.removeEventListener("keydown",handleEnterIsCreate);
  document.removeEventListener("keydown",handleEnterIsModify);
  document.removeEventListener("keydown",handleEscape);
}

// on submitting the form, add the bookmark to the buffer then update the display and the JSON file
function addBookmark() {
  {
    document.removeEventListener("keydown",(event) => {if(event.key == "Enter") addBookmark();});
    const name = document.getElementById("nameInput").value;
    const url = document.getElementById("urlInput").value;
    const id = calculateNewId();
    const newObject = {
      "id": id,
      "name": name,
      "url": url
    }
    jsonData.push(newObject);
    if(DEBUG) {
      console.log("file modified in buffer :", jsonData);
    }
    hideBookmarkForm();
    hideCommands(); // au cas où les commandes étaient toujours affichées
    updateDisplay();
    writeInLocalStorage();
    writeJsonFile();
  }
}

// Supprimer un élément du buffer
function removeBookmark(id) {
  for (let index in jsonData) {
    if (jsonData[index].id == id) {
      jsonData.splice(index, 1);
      if(DEBUG) {
        console.log("Element removed from buffer :", jsonData);
      }
      updateDisplay();
      writeInLocalStorage();
      writeJsonFile();
      return 1;
    }
  }
  if(DEBUG) {
    console.log("Element absent du fichier JSON");
  }
  return 0;
}

// Modifier un élément du buffer
function modifyBookmark() {
  const id = document.getElementById("bookmarkForm").dataset.targetBookmark;
  const name = document.getElementById("nameInput").value;
  const url = document.getElementById("urlInput").value;
  jsonData.forEach((element) => {
    if(element.id == id) {
      element.name = name;
      element.url = url;
    }
  });
  if(DEBUG) {
    console.log("Element modified in buffer :", jsonData);
  }
  hideBookmarkForm();
  updateDisplay();
  writeInLocalStorage();
  writeJsonFile();
}

function moveBookmarkLeft(id) {
  let elementToMove;
  jsonData.forEach((elem) => {if(elem.id == id) elementToMove=elem});
  const index = jsonData.indexOf(elementToMove);
  if (index > 1) { // reminder : the first element is the owner's name
    jsonData[index] = jsonData[index-1];
    jsonData[index-1] = elementToMove;
    updateDisplay();
  }
}

function moveBookmarkRight(id) {
  let elementToMove;
  jsonData.forEach((elem) => {if(elem.id == id) elementToMove=elem});
  const index = jsonData.indexOf(elementToMove);
  if (index < jsonData.length-1) { 
    jsonData[index] = jsonData[index+1];
    jsonData[index+1] = elementToMove;
    updateDisplay();
  }
}

function showCommands() {
  Array.prototype.slice.call(document.getElementsByClassName("bookmarkActionsContainer")).forEach((elem) => {elem.style.display = "flex";});
  commandsHideState = false;
  document.getElementById("editBookmarksBtn").textContent = "Done";
  document.getElementById("editBookmarksBtn").removeEventListener("click", showCommands);
  document.getElementById("editBookmarksBtn").addEventListener("click", hideCommands);
}

function hideCommands() {
  Array.prototype.slice.call(document.getElementsByClassName("bookmarkActionsContainer")).forEach((elem) => {elem.style.display = "none";});
  commandsHideState = true;
  document.getElementById("editBookmarksBtn").textContent = "Edit";
  document.getElementById("editBookmarksBtn").removeEventListener("click", hideCommands);
  document.getElementById("editBookmarksBtn").addEventListener("click", showCommands);
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
    Array.prototype.slice.call(document.getElementsByClassName("bookmarkActionsContainer")).forEach((elem) => {elem.style.display = "none";});
  }

  // ajouter les événements aux éléments raffraîchis
  document.getElementById('addNewBookmarkButton').addEventListener('click', showNewBookmarkForm);
  Array.prototype.slice.call(document.getElementsByClassName('removeCardBtn')).forEach((btn) => {btn.addEventListener('click', (event) => { removeBookmark(event.target.dataset.bookmarkId) })});
  Array.prototype.slice.call(document.getElementsByClassName('modifyCardBtn')).forEach((btn) => {btn.addEventListener('click', (event) => { showModificationForm(event.target) })});
  Array.prototype.slice.call(document.getElementsByClassName('moveCardLeftBtn')).forEach((btn) => {btn.addEventListener('click', (event) => { moveBookmarkLeft(event.target.dataset.bookmarkId) })});
  Array.prototype.slice.call(document.getElementsByClassName('moveCardRightBtn')).forEach((btn) => {btn.addEventListener('click', (event) => { moveBookmarkRight(event.target.dataset.bookmarkId) })});
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
    console.err.log("Error creating card : ", e);
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
  // Vérifier si l'utilisateur est déjà authentifié
  checkAuthentication();

  // Ajout des événements
  document.getElementById("editBookmarksBtn").addEventListener("click", showCommands);
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
  document.getElementById("closeBookmarkFormBtn").addEventListener("click", () => {focusedElement = undefined});
  document.getElementById("submitBookmarkForm").addEventListener("click", () => {focusedElement = undefined});
  document.addEventListener("keydown", (event) => {
    if (event.key == "Escape") focusedElement = undefined;
    if (event.key == "Enter") focusedElement = undefined;
  });
}

document.addEventListener('DOMContentLoaded', init);