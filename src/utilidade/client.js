function publicClient(client) {
  if (!client) {
    return null;
  }

  const { senha, ...safeClient } = client;
  return safeClient;
}

module.exports = { publicClient };
