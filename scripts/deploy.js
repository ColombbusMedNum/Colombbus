// Déploie sur Vercel en cachant temporairement le(s) dossier(s) .git.
//
// Pourquoi : le compte Vercel de ce projet n'est relié à aucun GitHub, mais
// dès qu'un dossier .git est visible, le CLI Vercel lit quand même le commit
// courant et bloque le déploiement ("commit email could not be matched to a
// GitHub account"). Git remonte à l'arborescence parente si le .git local
// est absent — le dossier C:\xampp2\htdocs\DEV est LUI-MÊME un dépôt Git,
// donc les deux niveaux doivent être cachés, pas seulement celui du projet.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const GIT_DIRS = [
  path.join(__dirname, "..", ".git"), // C:\xampp2\htdocs\DEV\colombbus\.git
  path.join(__dirname, "..", "..", ".git"), // C:\xampp2\htdocs\DEV\.git
];

const hidden = [];
for (const gitDir of GIT_DIRS) {
  if (fs.existsSync(gitDir)) {
    const backupDir = gitDir + "_backup";
    fs.renameSync(gitDir, backupDir);
    hidden.push({ gitDir, backupDir });
    console.log(`→ ${gitDir} temporairement renommé`);
  }
}

let exitCode = 0;
try {
  execSync("vercel --prod", { stdio: "inherit", cwd: path.join(__dirname, "..") });
} catch (error) {
  exitCode = error.status || 1;
} finally {
  for (const { gitDir, backupDir } of hidden) {
    if (fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, gitDir);
      console.log(`→ ${gitDir} restauré`);
    }
  }
}

process.exit(exitCode);
