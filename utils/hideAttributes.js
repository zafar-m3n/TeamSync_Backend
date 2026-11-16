// Keeps server-only columns out of API responses. The default scope leaves them out of
// queries (includes too) and toJSON strips them from instances built by create/save.
// Server code that needs them reads through Model.scope(scopeName).
const hideAttributes = (Model, attributes, scopeName) => {
  Model.addScope("defaultScope", { attributes: { exclude: attributes } }, { override: true });
  Model.addScope(scopeName, {});

  const baseToJSON = Model.prototype.toJSON;
  Model.prototype.toJSON = function toJSON() {
    const values = baseToJSON.call(this);
    for (const attribute of attributes) {
      delete values[attribute];
    }
    return values;
  };
};

module.exports = hideAttributes;
