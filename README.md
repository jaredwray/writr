![Writr](logo.png)

---

### A Simple to Use Markdown Blog 
[![Build Status](https://travis-ci.org/jaredwray/writr.svg?branch=master)](https://travis-ci.org/jaredwray/writr)
[![GitHub license](https://img.shields.io/github/license/jaredwray/writr)](https://github.com/jaredwray/writr/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/writr/branch/master/graph/badge.svg)](https://codecov.io/gh/jaredwray/writr)
[![npm](https://img.shields.io/npm/dw/writr)](https://npmjs.com/packages/writr)

---

## Getting Started 

## 1. Install Writr

> npm install -g writr 

## 2. Setup your directory (look at /blog_example for how to do this)

```
blog/*.md           //markdown files in the folder root
blog/images         //images for the blog
blog/config.json    //config file
blog/templates      //template directory for your index, post, and tag
```

## 3. Run Writr on it with defaults. This will output everything to ./blog_output

> writr --path ./blog

## 4. Express Integration

Then in express map your `blog_output` via static files:

```javascript
app.use("/blog/*/images", express.static(path.join(__dirname, "blog_output/images")))
app.use("/blog/images", express.static(path.join(__dirname, "blog_output/images")))
app.use("/blog", express.static(path.join(__dirname, "blog_output")))
```

---

## CLI

* -h, --help: Output usage information
* -p, --path: Path of where the blog, and config are located
* -o, --output: Path of where to output the generated blog
* -r, --render: What do you want rendered such as html or json (example --render html,json)
* -c, --config: Configuration file location if different than 'path'

## Templates

There are three templates that are part of every instance of Writr. By default it goes in the `/blog/templates` directory. Here are the files and are in `Handlebars` format:
* index.hjs: This is the main template that lists all of the latest blogs or what you want to add. 
* post.hjs: The post itself and usually supporting items around that such as what is next to look at and tags. 
* tag.hjs: Showing articles by tag filtering.

## Markdown
To learn more about Markdown go here: https://markdownguide.org