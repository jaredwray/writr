# Writr - A Markdown Blog for Your Node App [![CircleCI](https://circleci.com/gh/jaredwray/writr.svg?style=svg&circle-token=be83600aa05416b6ceb6baae9cb1f272f41a03aa)](https://circleci.com/gh/jaredwray/writr)

## Initial Setup and Structure
* Setup your content in a directory like so:
```
blog/... << Articles go here>>
blog/images... << Images go here>>
```
We will default to the `blog/` folder unless you configure the custom path in the configuration.

* Create your Markdown Documents with the following `Meta Header`
```javascript
{
    title: "",
    author: "",
    url: "",
    createdAt: "",
    publishedAt: "",
    keywords: "",
    tags: ""
}
```

## How to use with Express

* Instal the module `yarn add writr` or if using Typescript do `yarn add @types/writr`
* Add it to your `Express` app such as the following code example:
```javascript
var express = require('express');
var app = express();

var writr = require('writr');
var writrConfig = {
    homeTemplate: 'views/blog_homepage.hjs',
    tagTemplate: 'views/blog_tags.hjs',
    articleTemplate: 'views/blog_article.hjs'

    /* Optional Configuration Below
    
    discussID: '', //Discuss Integration
    imagePath: '', //custom image path
    articlePath: '' //custom article path

    */
}


app.use('/blog', writr.initExpress(writrConfig));
```



### Markdown
To learn more about Markdown go here: https://guides.github.com/features/mastering-markdown/

## Templates

There are three templates that are part of every instance of Writr:
* home: This is the main template that lists all of the latest blogs or what you want to add. 
* article: The article itself and usually supporting items around that such as what is next to look at and tags. 
* tags: Showing articles by tag filtering.
* _header: This is *Optional* and is not required but if you do specify it this will be included in the templates above for any header items you would like to include. 

