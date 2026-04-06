module.exports = {
  testEnvironment: "node",
  transform: {
<<<<<<< HEAD
    "^.+\\.js$": "babel-jest"
  },
=======
    "^.+\\.js$": "babel-jest",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!node-fetch)/" // Allow node-fetch through Babel
  ],
>>>>>>> sprint1
};