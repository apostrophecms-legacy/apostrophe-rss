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
      // use a wrapper div so we don't blow up the area editing buttons
      $widget.find('[data-rss-content]').html(result);
    }
  );
};
