const app = require('./../server').app;
const error = require('./../error');
const imgur = require('./../imgur')
const db = require('./../database');

const renderWithError = (page, username, error, res) => {
  res.render(page, { username, error });
};

app.get('/edit', function(req, res, next) {
  if (req.user) { // if logged in
    db.getTitleAndBio(req.user.username)
    .then(row => {
      res.render('edit/text', { 
        username: req.user.username,
        title: `"${row.title}"`,
        bio: row.bio
      });
    })
    .catch(err => {
      console.log(err);
      renderWithError('edit/text', req.user.username, 'Could not retrieve title or bio', res);
    });
  } else {
    console.log('Not authorised');
    res.render('login', {});
  }
});

app.post('/editText', function(req, res) {
  if (!req.user || !req.user.username) {
    console.log('Not authorised');
    return res.render('login', {});
  }
  if (!req.body || !req.body.title) {
    return renderWithError('edit/text', 'No title provided', res);
  }
  const bio = (!req.body.bio)
                ? ""  // allow no bio
                : req.body.bio.replace(/(?:\r\n|\r|\n)/g, '<br>'); // replace \n with <br \>
  db.updateTitleAndBio(req.user.username, req.body.title, bio)
    .then((row) => {
      res.render('edit/image', {
        username: req.user.username
      });
    })
    .catch(err => {
      error.handleError(err, res, 'edit/text');
    });
});

app.get('/editImage', function(req, res) {
  if (!req.user || !req.user.username) {
    console.log('Not authorised');
    return res.render('login', {});
  }
  res.render('edit/image', {
    username: req.user.username
  });
});

app.post('/editImage', function(req, res) {
  if (!req.user || !req.user.username) {
    console.log('Not authorised');
    return res.render('login', {});
  }

  if (!req.files || Object.keys(req.files).length == 0) {
    return res.status(400)
            .render('edit/image', { 
              username: req.user.username,
              error: 'Please select an image'
            });
  }

  let username = req.user.username;

  let coverPhotoFile = req.files.coverPhoto;
  if (coverPhotoFile.truncated) {
    return res.status(400)
            .render('edit/image', { 
              username: req.user.username,
              error: 'Cover photo too large'
            });
  }
  
  let coverPhoto = {
    encoded: coverPhotoFile.data.toString('base64'),
    size: coverPhotoFile.size,
    type: coverPhotoFile.mimetype
  };

  if (coverPhoto.type != 'image/jpeg' && coverPhoto.type != 'image/png') {
    return res.status(400)
            .render('edit/image', { 
              username: req.user.username,
              error: 'Invalid file type'
            });
  }

  // upload to imgur and save result to db
  imgur.upload(coverPhoto)
    .then(imageUrl => {
      return db.updateImageUrl(imageUrl, username);
    })
    .then(row => {
      res.render('edit/styles', {
        username: username,
        font: row.font
      });
    })
    .catch(err => {
      error.handleError(err, res, 'edit/image');
    });
});

app.get('/editStyles', function(req, res) {
  if (!req.user || !req.user.username) {
    console.log('Not authorised');
    return res.render('login', {});
  }
  db.getFont(req.user.username)
    .then((font) => {
      res.render('edit/styles', {
        username: req.user.username,
        font
      });
    })
    .catch(err => {
      console.log(err);
      renderWithError('edit/styles', req.user.username, 'Could not retrieve font', res);
    });
});

app.post('/editStyles', function(req, res) {
  if (!req.user || !req.user.username) {
    console.log('Not authorised');
    return res.render('login', {});
  }
  if (!req.body || !req.body.font) {
    return renderWithError('edit/styles', req.user.username, 'No font provided', res);
  }
  db.updateFont(req.user.username, req.body.font)
    .then((row) => {
      res.render('personal', {
        title: row.title,
        bio: row.bio,
        imageUrl: row.url,
        font: row.font
      });
    })
    .catch(err => {
      error.handleError(err, res, 'edit/styles');
    });
});