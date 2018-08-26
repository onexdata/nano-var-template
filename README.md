# nano-var-template
The smallest safe variable template engine possible (without eval / new function / injecting ES6 backticks or other things you can't expose in userland).

This engine even (optionally) throws descriptive errors if you type a variable path wrong.  Catch or route them as you see fit.

This template engine only handles variable injection into strings, just like ES6 backtick strings, but usable anywhere in your code. Designed specifically for userland.  Let your users define i18n strings, etc. without worry that they'll hack you.

Supports full paths in variables, not just shallow variables. i.e. user.data.name.first

805 bytes uncompressed source with comments.
274 bytes minified/gzipped

This is written in ES6 for Node and modern tools like Webpack.  The code is so small and simple, feel free to refactor it for the browser or back to ES5 for IE11 / etc.

Pull requests are always welcome.


## Install:

NPM
```
npm install nano-var-template
```

Yarn
```
yarn add nano-var-template
```

## Usage:

### Basic
```
const tpl = require('nano-var-template')()
console.log(tpl("Hello {{user}}!", {user: "Jane Doe"}))
```

```
Output: Hello Jane Doe!
```

### More practical
```
const tpl = require('nano-var-template')()

let template = "Welcome to {{app}}. You are {{person.name.first}} {{person.name.last}}!"

let data = {
        app: "Super App",
        person: {
            name: {
              first: "Jane",
              last: "Doe"
            }
        }
    }
    
console.log(tpl(template, data))
```

```
Output: Welcome to Super App. You are Jane Doe!
```

### Change defaults to make it feel like ES6
```
const tpl = require('nano-var-template')( {start: '${', end: '}'} )
console.log(tpl("Hello ${user}!", {user: "Jane Doe"}))
```

```
Output: Hello Jane Doe!
```

### Make a mistake and get easy to understand debug errors
```
const tpl = require('nano-var-template')()
console.log(tpl("Hello ${user.name}!", {user: "Jane Doe"}))
```

```
Output: Error: nano-var-template: 'name' missing in ${user.name}
```
