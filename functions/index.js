const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
var admin = require("firebase-admin");

var serviceAccount = require("../firestore-backup-d9f43-firebase-adminsdk-574cw-c008badfb7.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://firestore-backup-d9f43.firebaseio.com",
});

const db = admin.firestore();

const getAllCollections = async () => {
  const collections = await db.listCollections();
  return collections.map((collection) => collection._queryOptions.collectionId);
};

const getAllDocuments = async (collectionName) => {
  const documents = [];
  const qSnapshots = await db.collection(collectionName).get();
  qSnapshots.forEach((doc) => {
    documents.push({
      doc_id: doc.id,
      doc_data: doc.data(),
    });
  });
  return documents;
};

const storeBackupInStorage = async dbBackup => {
  const bucket = admin.storage().bucket('firestore-backup-d9f43.appspot.com');
  const fs = require('fs');
  const destinatonFile = bucket.file("backup.json");
  var buf = Buffer.from(JSON.stringify(dbBackup), 'utf8');
  await destinatonFile.save(buf);
  // await destinatonFile.setMetadata(dbBackup);
  // const bucket = storage.bucket('firestore-backup-d9f43.appspot.com');
  // const options = {
  //   destination: 'backup.json'
  // };

  try {
    fs.writeFileSync('backup.json', dbBackup);
    bucket.upload('backup.json', options)
  } catch (error) {
    console.log('error :>> ', error);
  }
}

/**
 * To make a backup point of all collections
 */
exports.backup = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    return new Promise(async (resolve) => {
      const collections = await getAllCollections();
      const dbBackup = {};
      for (let collection of collections) {
        if (!dbBackup[collection]) {
          dbBackup[collection] = {
            collectionName: collection,
            documents: []
          }
        }
        const documents = await getAllDocuments(collection);
        dbBackup[collection] = documents;
      }
      storeBackupInStorage(dbBackup);
      response.status(200).send({
        error: false,
        data: dbBackup,
      });
      resolve(true);
    }).catch((err) => {
      res.status(401).send(err);
    });
  });
});

const restore = async () => {
  const bucket = admin.storage().bucket('firestore-backup-d9f43.appspot.com');
  const destinatonFile = bucket.file("backup.json");
  const fileData = await destinatonFile.download();
  return JSON.parse(fileData.toString());
}


/**
 * To restore
 */
exports.restore = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    return new Promise(async (resolve) => {
      const restoreData = await restore();
      response.status(200).send({
        error: false,
        data: restoreData,
      });
      resolve(true);
    }).catch((err) => {
      res.status(401).send(err);
    });
  });
});