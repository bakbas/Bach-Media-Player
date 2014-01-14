require(["lib/jquery","lib/underscore","lib/backbone"], function() {
	"use strict";
	var playerView = Backbone.View.extend({
		el: $('header'),
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.html(_.template($('#player-template').html()));
		}
	});
});