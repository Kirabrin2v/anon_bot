const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");
const globals = require("globals");

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: [
      "node_modules",
      "dist",
      "build",
      "*.min.js",
      "logs/",
      "tmp/",
      "old_version/",
      "tests/",
      "modules/test/",
      "modules/*/*test.js"
    ]
  },
  js.configs.recommended,
  prettier,

  {
    files: ["**/*.js"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        BASE_DIR: "readonly",
      },
    },

    rules: {
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],

      "no-undef": "error",
      "no-console": "off",

      "eqeqeq": ["error", "always"],
      "curly": "error",

      "no-empty": "warn",
      "no-extra-boolean-cast": "warn",

      "no-var": "error",
      "prefer-const": "warn",

      "no-async-promise-executor": "error",
      "require-await": "warn",

      "no-invalid-this": "warn",

      "no-useless-call": "warn",
      "no-useless-return": "warn"
    }
  }
];
