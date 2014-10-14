var feedparser = require('feedparser');
var _ = require('lodash');
var cache = {};
var pending = {};

module.exports = function(options, callback) {
  return new Construct(options, callback);
};

module.exports.Construct = Construct;

function Construct(options, callback) {
  var apos = options.apos;
  var app = options.app;
  var self = this;
  self._apos = apos;
  self._app = app;
  var lifetime = options.lifetime ? options.lifetime : 60000;

  self._apos.mixinModuleAssets(self, 'rss', __dirname, options);

  // This widget should be part of the default set of widgets for areas
  // (this isn't mandatory)
  apos.defaultControls.push('rss');

  // Include our editor template in the markup when aposTemplates is called
  self.pushAsset('template', 'rssEditor', { when: 'user' });

  // Make sure that aposScripts and aposStylesheets summon our assets

  // We need the editor for RSS feeds. (TODO: consider separate script lists for
  // resources needed also by non-editing users.)
  self.pushAsset('script', 'content', { when: 'always' });
  self.pushAsset('script', 'editor', { when: 'user' });
  self.pushAsset('stylesheet', 'content', { when: 'always' });

  self.widget = true;
  self.label = options.label || 'RSS Feed';
  self.css = options.css || 'rss';
  self.icon = options.icon || 'icon-rss';

  self.jsonProperties = [ '_ajax' ];

  self.sanitize = function(item) {
    if (!item.feed.match(/^https?\:\/\//)) {
      item.feed = 'http://' + item.feed;
    }
    item.limit = parseInt(item.limit, 10);
  };

  self.renderWidget = function(data) {
    if (data.item._ajax) {
      // We've decided to let the browser
      // fetch this with a separate AJAX requet
      return '';
    } else {
      // We're rendering it now, during the page load,
      // server side
      return self.render('rss', data);
    }
  };

  app.get('/apos-rss/render-feed', function(req, res) {
    var item = {
      feed: apos.sanitizeString(req.query.feed),
      limit: apos.sanitizeInteger(req.query.limit)
    };
    return self.loadFeed(item, function() {
      return res.send(self.renderWidget({ item: item }));
    });
  });

  // Loader method for the widget
  self.load = function(req, item, callback) {
    var key = self.getKey(item);
    // If it's in the cache, "load" it now. Avoid a separate
    // AJAX request.
    if (cache[key]) {
      return self.loadFeed(item, callback);
    }
    // It's not in the cache. Mark it as needing to be
    // loaded by the browser so we don't block the
    // rest of the page from loading now. We can do that
    // because it's not important for Google to see
    // RSS content on the page.
    item._ajax = true;
    return setImmediate(callback);
  };

  // Generate a cache key for this item
  self.getKey = function(item) {
    return JSON.stringify({ feed: item.feed, limit: item.limit });
  };

  // Load the feed. Shared by self.load and the render-feed route
  self.loadFeed = function(item, callback) {

    // Asynchronously load the actual RSS feed
    // The properties you add should start with an _ to denote that
    // they shouldn't become data attributes or get stored back to MongoDB
    item._entries = [];

    var now = Date.now();
    // Take all properties into account, not just the feed, so the cache
    // doesn't prevent us from seeing a change in the limit property right away

    var key = self.getKey(item);

    // If we already have it, deliver it
    if (cache[key] && ((cache[key].when + lifetime) > now)) {
      item._entries = cache[key].data;
      item._failed = cache[key].failed;
      return callback();
    }

    // If we're already waiting for it, wait for it
    if (pending[key]) {
      pending[key].push({
        item: item,
        callback: function() {
          return callback();
        }
      });
      return;
    }

    // Start a pending queue for this request
    pending[key] = [];

    feedparser.parseUrl(item.feed).on('complete', function(meta, articles) {
      var end = Date.now();
      articles = articles.slice(0, item.limit);

      // map is native in node
      item._entries = articles.map(function(article) {
        return {
          title: article.title,
          body: article.description,
          date: article.pubDate,
          link: article.link
        };
      });

      // Cache for fast access later
      cache[key] = { when: now, data: item._entries };
      return done();
    }).on('error', function(error) {
      // Cache failures too, don't go crazy trying to get
      // to a feed that's down
      item._failed = true;
      cache[key] = { when: now, failed: true };
      return done();
    });
    function done() {
      // Notify everyone else who was waiting for this
      // fetch to finish
      _.each(pending[key], function(i) {
        i.item._entries = item._entries;
        i.item._failed = item._failed;
        return i.callback();
      });
      delete pending[key];
      return callback();
    }
  };

  apos.addWidgetType('rss', self);

  return setImmediate(function() { return callback(null); });
}
