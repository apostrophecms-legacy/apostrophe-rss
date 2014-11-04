apos.widgetPlayers.rss = function($widget) {
  var data = apos.getWidgetData($widget);
  if (!data._ajax) {
    // The server already populated it for us
    return;
  }

  $.get(
    '/apos-rss/render-feed',
    data,
    function(result) {
      $widget.html(result);
    }
  );
};
