# Writr - A Markdown Blog for Your Node App [![Build Status](https://travis-ci.org/jaredwray/writr.svg?branch=master)](https://travis-ci.org/jaredwray/writr)

![Writr](logo.png)

## Initial Setup and Structure
* Setup your content in a directory like so:
```
blog/... << Articles go here>>
blog/content... << Images and other content that you link to go here>>
```
We will default to the `blog/` folder unless you configure the custom path in the configuration.

* Create your Markdown Documents with the following `Meta Header`
```javascript
{
    "title": "",
    "author": "",
    "url": "",
    "createdAt": "",
    "publishedAt": "",
    "keywords": "",
    "previewKey": "",
    "tags": ""
}
```

## How to use with Express

* Instal the module `yarn add writr` or if using Typescript do `yarn add @types/writr`
* Add it to your `Express` app such as the following code example:
```javascript
var express = require('express');
var app = express();

var writr = require('writr');

writer.initExpress('/blog', app);
```

## Express with Configuration
```javascript
var express = require('express');
var app = express();

var writr = require('writr');

writer.initExpress('/blog', app, {
    contentPath: './public/content',
    postPath: './_posts',
    templatePath: './views/blog'
});
```

### Markdown
To learn more about Markdown go here: https://guides.github.com/features/mastering-markdown/

## Templates

There are three templates that are part of every instance of Writr:
* home: This is the main template that lists all of the latest blogs or what you want to add. 
* post: The post itself and usually supporting items around that such as what is next to look at and tags. 
* tags: Showing articles by tag filtering.

## Features

### Preview Key
At some point you will want to show the post before it is live. In that case you can set a secret key in the post meta information called `previewKey`. Once you have set this and saved the post you can browse to your blog with the url of the post adding `?previewKey=YOUR_SECRET` at the end. 