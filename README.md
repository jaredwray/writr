![Writr](logo.png)

---

### A Markdown Blog for Your Node App 
[![Build Status](https://travis-ci.org/jaredwray/writr.svg?branch=master)](https://travis-ci.org/jaredwray/writr)
[![GitHub license](https://img.shields.io/github/license/jaredwray/writr)](https://github.com/jaredwray/writr/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/writr/branch/master/graph/badge.svg)](https://codecov.io/gh/jaredwray/writr)

## Getting Started 

> npm install writr

or 

> yarn add writr

* Setup your content in a directory like so:
```
blog/... << Articles go here>>
blog/images... << Images and other content that you link to go here>>
```
We will default to the `blog/` folder unless you configure the custom path in the configuration.

* Create your Markdown Documents with the following `Meta Header` example. 
```yaml
---
title:  'Docula: Persistent Links and Styles!'
tags:
- Github
- Open Source
- Docula
date: 2017-03-07 19:49:09
featured_image: Docula_%20Persistent%20Links%20and%20Styles%201.jpeg
---
```

## CLI

> writr -c blog/writr.config -o ./blog_output

## CLI with 

> writr -c blog/writr.config -o ./blog_output --json

## Express Integration

Then in express map your `blog_output` via static files:

```javascript

app.use("/blog/*/images", express.static(path.join(__dirname, "blog/images")))
app.use("/blog/images", express.static(path.join(__dirname, "blog/images")))
app.use("/blog", express.static(path.join(__dirname, "blog_output")))


```

### Markdown
To learn more about Markdown go here: https://markdownguide.org

## Templates

There are three templates that are part of every instance of Writr:
* index: This is the main template that lists all of the latest blogs or what you want to add. 
* post: The post itself and usually supporting items around that such as what is next to look at and tags. 
* tags: Showing articles by tag filtering.
