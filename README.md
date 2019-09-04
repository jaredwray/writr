![Writr](logo.png)

---

### A Markdown Blog for Your Node App 
[![Build Status](https://travis-ci.org/jaredwray/writr.svg?branch=master)](https://travis-ci.org/jaredwray/writr)
[![GitHub license](https://img.shields.io/github/license/jaredwray/writr)](https://github.com/jaredwray/writr/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/writr/branch/master/graph/badge.svg)](https://codecov.io/gh/jaredwray/writr)

## Getting Started 

> npm install -g writr 

## Setup your directory (look at /blog_example for how to do this)

```
blog/*.md           //markdown files in the folder root
blog/images         //images for the blog
blog/config.json    //config file 
```

## Run Writr on it with defaults

> writr --path ./blog

## This will output everything to ./blog_output


## Express Integration

Then in express map your `blog_output` via static files:

```javascript
app.use("/blog/*/images", express.static(path.join(__dirname, "blog_output/images")))
app.use("/blog/images", express.static(path.join(__dirname, "blog_output/images")))
app.use("/blog", express.static(path.join(__dirname, "blog_output")))
```

## CLI

> writr -p ./blog -o ./blog_output

## CLI with JSON (data.json) Output

> writr -p ./blog -o ./blog_output --json

### Markdown
To learn more about Markdown go here: https://markdownguide.org

## Templates

There are three templates that are part of every instance of Writr:
* index: This is the main template that lists all of the latest blogs or what you want to add. 
* post: The post itself and usually supporting items around that such as what is next to look at and tags. 
* tags: Showing articles by tag filtering.
