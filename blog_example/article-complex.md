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

In our last update, we simplified the modules down to two ([docula-ui](https://www.npmjs.com/package/docula-ui), and [docula-core](https://www.npmjs.com/package/docula-core)) and also added In-Memory data stores as the default. Now with this latest update, we made it so that you can do [persistent linking](https://docu.la/docs/article/configuration/deeplinks) and [customize the interface](https://docu.la/docs/article/configuration/customization) it very easily.

### Persistent Linking

There are many times a document can move around in a GitHub repository, but you want to keep to an URL that works. [Check out how to do it here!](https://docu.la/docs/article/configuration/deeplinks)

### Styling! Let’s Get Started

The first step is to see how we did this. Since we use [GitHub](https://github.com/) for our knowledge base repository, it made sense to extend the configuration for skinning there. Here is what the [Fons repository](https://github.com/fonsio/public-kb) looks like with the `style.css` and `navigation.html` file in the root.

![](Images/Docula_%20Persistent%20Links%20and%20Styles%202.png)

The configuration for your [docula-ui](https://www.npmjs.com/package/docula-ui) is easy to do the config. You will want to add in the style.css path and navigation.html path. Also, if you have a customized logo, you can do that. Here is an example that we use for Fons.

```
Docula.install(app, '/help', {git: 'https://github.com/fonsio/public-kb.git',pageTitle: 'Fons',logo: 'https://fons.io/n/img/fons-logo-300x85.png',redis: redisConfig(),elasticsearch: elasticConfig(),topNavigation: 'navigation.html',cssTheme: 'theme.scss'});
```

Yep, its as simple as that and you can see the style.css and navigation.html examples here: [https://github.com/fonsio/public-kb](https://github.com/fonsio/public-kb)

<div>
<p>foo</p>
</div>
***Happy Styling!***

