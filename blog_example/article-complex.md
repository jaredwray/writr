---
title:  'Docula: Persistent Links and Styles!'
tags:
- Github
- Open Source
- Docula
date: 2017-03-07
featured_image: Docula_%20Persistent%20Links%20and%20Styles%201.jpeg
---

![](Images/Docula_%20Persistent%20Links%20and%20Styles%201.jpeg)

## Docula: Persistent Links and Styles!

In our last update, we simplified the modules down to two (<u>[docula-ui](https://www.npmjs.com/package/docula-ui)</u>, and <u>[docula-core](https://www.npmjs.com/package/docula-core))</u> and also added In-Memory data stores as the default. Now with this latest update, we made it so that you can do <u>[persistent linking](https://docu.la/docs/article/configuration/deeplinks)</u> and <u>[customize the interface](https://docu.la/docs/article/configuration/customization)</u> it very easily.

### Persistent Linking

There are many times a document can move around in a GitHub repository, but you want to keep to an URL that works. <u>[Check out how to do it here!](https://docu.la/docs/article/configuration/deeplinks)</u>

### Styling! Let’s Get Started

The first step is to see how we did this. Since we use <u>[GitHub](https://github.com/)</u> for our knowledge base repository, it made sense to extend the configuration for skinning there. Here is what the <u>[Fons repository](https://github.com/fonsio/public-kb)</u> looks like with the `style.css` and `navigation.html` file in the root.

![](Images/Docula_%20Persistent%20Links%20and%20Styles%202.png)

The configuration for your <u>[docula-ui](https://www.npmjs.com/package/docula-ui)</u> is easy to do the config. You will want to add in the style.css path and navigation.html path. Also, if you have a customized logo, you can do that. Here is an example that we use for Fons.

```
Docula.install(app, '/help', {git: 'https://github.com/fonsio/public-kb.git',pageTitle: 'Fons',logo: 'https://fons.io/n/img/fons-logo-300x85.png',redis: redisConfig(),elasticsearch: elasticConfig(),topNavigation: 'navigation.html',cssTheme: 'theme.scss'});
```

Yep, its as simple as that and you can see the style.css and navigation.html examples here: <u>[https://github.com/fonsio/public-kb](https://github.com/fonsio/public-kb)</u>

***Happy Styling!***

