// Builds the PWA and force-pushes dist/ to the gh-pages branch (served by GitHub Pages).
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd });
const remote = execSync('git remote get-url origin').toString().trim();
run('npm run build');
writeFileSync('dist/.nojekyll', '');
const helper = '-c credential.helper= -c "credential.helper=!gh auth git-credential"';
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run('git -c user.name="Declutter Deploy" -c user.email="deploy@localhost" commit -q -m "Deploy"', 'dist');
run(`git ${helper} push -f ${remote} gh-pages`, 'dist');
console.log('Deployed to gh-pages');
