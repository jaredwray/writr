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

## Different Layouts

You can also set a post to use a different layout by setting the `layout` value in the `front-matter` like so:

```yaml
---
title:  'Docula: Persistent Links and Styles!'
tags:
- Github
- Open Source
- Docula
date: 2017-03-07
layout: post2
featured_image: Docula_%20Persistent%20Links%20and%20Styles%201.jpeg
---
```

## Permalinks

In your posts `front-matter` you can specify the format of the url to be generated. Be default is the `:title` (also known as the `none` style) that is formatted correctly. 

### Variables

| Variable | Description |
| --- | ----------- |
| year | Year from the post’s filename with four digits. |
| short_year | Year from the post’s filename without the century. (00..99) |
| month | Month from the post’s filename. (01..12) |
| i_month | Month without leading zeros |
| short_month | Three-letter month abbreviation, e.g. "Dec". |
| long_month | Full month name, e.g. “January”. |
| day | Day of the month from the post’s filename. (01..31) |
| i_day | Day of the month without leading zeros from the post’s filename. |
| short_day | Three-letter weekday abbreviation, e.g. “Sun”. | 
| long_day | Weekday name, e.g. “Sunday”. |
| week | Week number of the current year, starting with the first week having a majority of its days in January. (01..53) |
| hour | Hour of the day, 24-hour clock, zero-padded from the post’s date front matter. (00..23) |
| minute | Minute of the hour from the post’s date front matter. (00..59) |
| second | Second of the minute from the post’s date front matter. (00..59) |
| title | Title from the document’s front matter. | 


### Default Styles

You can simply put in the style on permalink setting in the individual post `front-matter` or globally in `config.json`

| Style | Template |
| --- | ----------- |
| none (default) | /:title/ |
| date | /:year/:month/:date/:title/ |
| ordinal | /:year/:y_day/:title/ |
| weekdate | /:year/W:week/:short_day/:title/ |


### Set it in the Post

```yaml
---
title:  'Docula: Persistent Links and Styles!'
tags:
- Github
- Open Source
- Docula
permalink: simple
date: 2017-03-07
layout: post2
featured_image: Docula_%20Persistent%20Links%20and%20Styles%201.jpeg
---
```

### Set it Globally

To set it globally you can set it in the `config.json` by setting the `permaLink` variable like so:
```javascript
{
    "output" : "./blog_output",
    "render": [ "html" , "json", "atom", "images"],
    "path": "./blog_example",
    "title": "Example Blog",
    "url": "https://writr.io/blog",
    "authorName": "Jared Wray",
    "authorEmail": "me@jaredwray.com",
    "permalink": ":year/:month/:title"
}
```


## Markdown
To learn more about Markdown go here: https://markdownguide.org