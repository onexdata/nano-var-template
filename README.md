# nano-var-template
The smallest safe variable template engine that includes a functor strategy pattern.  This is done without eval / new function / injecting ES6 backticks or other things you can't expose in userland.

This engine even (optionally) throws descriptive errors if you type a variable path wrong.  Catch or route them as you see fit.

Designed specifically for userland.  Let your users define i18n strings, call out your users, reference documents, invoke plugins etc. without worry that they'll hack you by including javascript or HTML.

Just strip HTML / JavaScript like you normally would, and use plugins to allow your users the exact power they need! :)

* Supports full paths in variables, not just shallow variables. i.e. user.data.name.first works.
* Supports calling functions as plugins using a simple strategy pattern (make an object of named functions, example toward bottom).
* Default variables are injected inside ${} (but you can modify this)
* Default functions are injected inside #{} (but you can modify this)

# Only 1.24kb uncompressed source, including comments.
# Only 621 bytes gzipped.
# Only 372 bytes minified/gzipped (!!!)

This is written in ES6 for Node and modern tools like Webpack.  The code is small, understandable and simple, feel free to refactor it for the browser or back to ES5 for IE11 / etc. if you aren't using Babel / Webpack.

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
console.log(tpl("Hello {user}!", {user: "Jane Doe"}))
```

```
Output: Hello Jane Doe!
```

### More practical
```
const tpl = require('nano-var-template')()

let template = "Welcome to ${app}. You are ${person.name.first} ${person.name.last}!"

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

### Change defaults to make it feel like Vue/Angular/etc.
```
const tpl = require('nano-var-template')( {start: '{{', end: '}}'} )
console.log(tpl("Hello {{user}}!", {user: "Jane Doe"}))
```

```
Output: Hello Jane Doe!
```

### Do something custom...
```
const tpl = require('nano-var-template')( {start: '@#[', end: ']#'} )
console.log(tpl("Hello @#[user]#!", {user: "Jane Doe"}))
```

```
Output: Hello Jane Doe!
```


### Parse variables, plugins (like wordPress shortcodes), and users in messages by just using different settings...
```
const Tpl = require('nano-var-template')
var varTpl = Tpl()
var userTpl = Tpl( {start: '@{', end: '}')
var pluginTpl = Tpl( {start: '#{', end: '}', functions: true} )

// Yes, you can pipe the output of one template (i.e. variables) into another (ie.e plugins) as many levels deep as you need...
var msg = "Hi @{${user.id}}! Here is your avatar: #{avatar:${user.settings.avatar}}. Your first name is ${user.name.first} and your last name is ${user.name.last} Here is the response of a special plugin for you: #{foo}"
var data = {
        app: "Super App",
        user: {
             id: '123',
            name: {
              first: "Jane",
              last: "Doe"
            },
            settings: {
              avatar: 'default'
            }

        }
    };
var plugins = {
  avatar: (id) => "<avatar :id='" +id + "' />",
  foo: () => { return "What your function returns (this string) is what gets injected." },
  example: (vars) => {
    // Functions can be as complex as you need. Any JavaScript function works.
    // It will recieve anything after a ":" by default as it's variables. But you can change this too by setting your own regex path.
    // Try this example like this:
    // #{example} - returns "Got nothing"
    // #{example:test} - returns "Got 'test'"
    // #{example:test, another test, more vars, a string, 123} - returns "Got 'test, another test, more vars, a string, 123'"
    
    if (vars) return `Got ${vars}`
    return "Got nothing"

    // You can split up your vars passed to your functions like this: vars.split(",") // Note: replace "," with any delimiter you want!
  }
}
var users = {
  123: 'Jane Doe, Administrator'
}
var tpl = pluginTpl(userTpl(varTpl(msg, data), users), plugins)


console.log(tpl) // Out to console, or...

document.write(tpl) // Out to browser (showing avatar, highlighting, etc.)
```

```
Output:

Hi Jane Doe, Administrator! Here is your avatar: <avatar :id='default' />. Your first name is Jane and your last name is Doe Here is the response of a special plugin for you: What your function returns (this string) is what gets injected.
```


### Make a mistake and get easy to understand debug errors
```
const tpl = require('nano-var-template')()
console.log(tpl("Hello ${user.name}!", {user: "Jane Doe"}))
```

```
Output: Error: nano-var-template: 'name' missing in ${user.name}
```

### Options you can modify (showing defaults)
You can set options when you require the module by simply placing options in the parens when requiring like this:
```
const tpl = require('nano-var-template')( {options})

```

Or if you prefer, you can do it separately...
```
const Tpl = require('nano-var-template')
const tpl = new Tpl( {options} )

```

Here are the options you can currently define...
```
{
  start: '{', // Place the start of the variable match here (can be any number of chars).
  end: '}',   // Place the end of the variable match here.
  functions: true // Set to true if you will be using a functor (object of functions) instead of a data object
  path: '[a-z0-9_$][\\.a-z0-9_]*', // Regular expression for allowed paths.  If you don't want to allow certain variables for example, or limit paths, do it here.
  warn: true  // By default, will throw an error warning you if you try to reference a variable not passed. Set this to false to just skip the missing variable silently.
}
```