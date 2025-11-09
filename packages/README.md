# flow

Functional programming utility functions

To work on the package with HMR, make a sym link to the package from inside external example app.

mkdir -p @flow
cd @flow
ln -s ../../packages packages

Now vite will treat your edits as example app source code - voila, HMR. The vite config resolves the alias to the folder in your example app - but now it looks consistent as if you had installed the package itself.
