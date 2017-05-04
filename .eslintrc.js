module.exports = {
    "parser": 'babel-eslint',
    "parserOptions": {
        ecmaVersion: 6,
        sourceType: 'module'
    },
    "extends": "vue",
    "env": {
        browser: true,
        amd: true,
        es6: true,
        node: true,
        mocha: true
    },
    "rules": {
        "no-console": 0,
        "no-alert": 1,
        "indent": ["warn", 4]
    }
}
