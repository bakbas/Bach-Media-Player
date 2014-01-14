"use strict";
require.config({
	baseUrl: "js/lib",
    paths: {
        jquery: "jquery.min",
        underscore: "underscore.min",
        backbone: "backbone.min",
    },
    shim: {
        backbone: {
            deps: ['jquery', 'underscore'],
            exports: 'Backbone'
        },
        underscore: {
            exports: '_'
        },
        jquery: {
            exports: '$'
        }
    }
});

define(["jquery","underscore","backbone"], function($, _, Backbone) {

	var playerView = Backbone.View.extend({
		template: _.template($('#player-template').html()),
		render: function() {
			this.$el.html();
		}
	});

	var Router = Backbone.Router.extend({
		routes: {
			'': 'home',
			'song/:title': 'song'
		},
		home: function() {

		},
		song: function(title) {

		}
	});

	var router = new Router();
	Backbone.history.start();
});