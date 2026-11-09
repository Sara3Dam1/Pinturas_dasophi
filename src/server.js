const app = require("./app");
const { port } = require("./config");

app.listen(port, "0.0.0.0", () => {
  console.log(`Pinturas da Sophi em http://localhost:${port}`);
});
