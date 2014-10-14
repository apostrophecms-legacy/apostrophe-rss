apos.widgetPlayers.rss = function($widget) {
  var data = apos.getWidgetData($widget);
  if (!data._ajax) {
    // The server already populated it for us
    return;
  }

  var feed = data.feed;
  var limit = data.limit;

  $.get(
    '/apos-rss/render-feed',
    {
      feed: feed,
      limit: limit
    },
    function(result) {
      $widget.html(result);
    }
  );
};
