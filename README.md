# Markbooks Manager par Lou REINA--KUNTZIGER
## Comment utiliser ?
L'application web enregiste les marque pages dans un fichier json sur Dropbox.
* Créer une application Dropbox sur https://dropbox.com/developers
* Ajouter `https://loureinak.github.io/bookmarksManager/` aux adresses de redirection autorisées
* Dans les droits d'accès aux fichiers, ajouter lecture et écriture
* Copier la clé de l'application (APP KEY) et la coller dans le fichier index.js (ligne 1)
* Créer un fichier Json et le déposer dans le répertoire de l'application sur [Dropbox](https://dropbox.com/home).
Exemple :
```json
[{
    "id": -1,
    "name": "Lou"
},
{
    "id": 0,
    "name": "Github",
    "url": "https://github.com/loureinak"
}]
```
* Dans index.js, adapter FILE_PATH (ligne 2) au fichier Json déposé sur Dropbox