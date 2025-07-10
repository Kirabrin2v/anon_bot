const fetch = require('node-fetch');
const fs = require('fs');

function downloadFile(url, path) {
  return fetch(url).then(res => {
    res.body.pipe(fs.createWriteStream(path));
  });
}

// Using
downloadFile('http://textures.minecraft.net/texture/39aafa5a7dc9f5bba73a4085de5eea6499f1638cdfc9a61d2fcc1b9ec7c426e9','artboar8d-53.jpg')
   .then(()=>console.log('OK'))
   .catch(err=>console.error(err));
