const app = require("./app");
const { port } = require("./config");

app.listen(port, () => {
  console.log(`Pinturas da Sophi em http://localhost:${port}`);
});
