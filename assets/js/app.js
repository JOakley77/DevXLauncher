var app = {

	// initial DOM elements
	$DOM	: {},

	// application data object
	$data	: {}
};

app.__sort = function( field, reverse, primer ) {

	var key = function ( x ) {
		return primer ? primer( x[ field ] ) : x[ field ]
	};

	return function ( a, b ) {
		var A = key( a ), B = key( b );
		return ( A < B ? -1 : ( A > B ? 1 : 0 ) ) * [ 1, -1 ][ +!!reverse ];                  
	}
};

app.__notification = function( type, message ) {

	var options = {
		images	: {
			error: 'error.png',
			success: 'success.png'
		},
		title	: 'Message',
		img		: ''
	};

	switch ( type ) {
		case 'error':
			options.title = 'Error',
			options.img = options.images.error
			break;
	}

	var notification = window.webkitNotifications.createNotification(
		options.img,
		options.title,
		message
	);

	notification.show();
};

/**
 * Private methods
 */

app.__create_list = function( data ) {

	if ( data !== undefined && typeof data === 'object' && data.length > 0 ) {

		// set list start
		var list = app.$DOM.list.append( '<table class="table">' ).find( 'table.table' );

		// append table head
		list.append(
			'<thead>'
			+ '<tr>'
			+ '<th>Item</th>'
			+ '<th></th>'
			+ '</tr>'
			+ '</thead>'
			+ '<tbody></tbody>'
		);

		// loop through items and create table row
		$.each( data, function( key, val ) {
			list.find( 'tbody' ).append( 
				'<tr data-id="' + key + '">'
				+ '<td><a href="' + val.url + '" class="itemurl">' + val.label + '</a></td>'
				+ '<td>'
				+ '<div class="has-dropdown button-dropdown float-right">'
				+ '<a href="#" class="button" data-toggle="dropdown">Modify <span class="caret"></span></a>'
				+ '<ul class="dropdown right">'
				+ '<li><a href="#" class="edit">Edit</a></li>'
				+ '<li><a href="#" class="delete">Delete</a></li>'
				+ '</ul>'
				+ '</div>'
				+ '</td>'
				+ '</tr>'
			);
		});
	}
	else {
		app.$DOM.list.append( 'No links have been set yet' );
	}
};

app.__update_list = function() {
	var list = $( '#list' );

	list.find( 'table' ).remove();

	app.__create_list( app.$data.items );
};

app.__save = function( objects_to_save, objects_to_append, cb_afterResponse ) {

	var items	= {
		urls	: []
	};

	// if objects_to_save is undefined or null let's return false
	if ( objects_to_save === undefined || objects_to_save.length <= -1 ) {
		return false;
	}

	// push existing items to array
	if ( typeof objects_to_save === 'object' && objects_to_save.length !== 0 ) {
		$.each( objects_to_save, function( key, obj ) {
			items.urls.push( obj );
		});
	}

	// push new item into array
	if ( objects_to_append !== undefined && objects_to_append.length > -1 && typeof objects_to_append === 'object' ) {
		$.each( objects_to_append, function( key, obj ) {
			items.urls.push( obj );
		});
	}

	// sort data object
	items.urls.sort( app.__sort( 'label', false, function( a ) {
		return a;
	} ) );

	// save items
	chrome.storage.local.set({ items : items }, function() {
		
		// set app.$data items object
		app.$data.items = items.urls;

		if ( cb_afterResponse !== undefined && typeof cb_afterResponse === 'function' ) {
			cb_afterResponse();
		}
	});
};

app.__remove = function( id, cb_afterRemove ) {

	// remove requested id from item array
	var newList = app.$data.items.splice( parseInt( id, 10 ), 1 );

	// save new list
	app.__save( app.$data.items, '', function() {
		app.__update_list();
	});
};

/**
 * Public methods
 */

app.listeners = function() {

	// listener for form add
	document.querySelector( '#saveInput' ).addEventListener( 'click', app.save );

	// listener for url click event
	$( document ).on( 'click', '#list a.itemurl', function( e ) {
		e.preventDefault();

		var $this = $( e.currentTarget );

		chrome.tabs.getSelected( function( tab ) {
			//console.log( 'GOTO: ' + $this.attr( 'href' ) );
			chrome.tabs.update( tab.id, { url : $this.attr( 'href' ) } );
			window.close();
		});

		// create a new tab
		//chrome.tabs.create( { url: $this.attr( 'href' ) } );

		return false;
	});

	// listener for delete click event
	$( document ).on( 'click', '#list a.delete', function( e ) {
		e.preventDefault();

		var $this = $( e.currentTarget ),
			$id		= $this.parent().parent().parent().parent().parent().attr( 'data-id' );

		console.log( 'DELETE: ' + $id );

		app.__remove( $id, function() {
			console.log( 'item: ' + $id + ' was removed' );
		} );

		return false;
	});
};

app.save = function() {

	var $input = {
		label	: {
			el	: $( 'input#label' ),
			val	: ''
		},
		url	: {
			el	: $( 'input#url' ),
			val	: ''
		}
	},
	messages = [], i = 0;

	// set input val
	$input.label.val = $input.label.el.val();
	$input.url.val = $input.url.el.val();

	// validate $input.label
	if ( ! $input.label.val ) {
		messages.push( 'Label was not specified' );
	}

	// validate $input.url
	if ( ! $input.url.val ) {
		messages.push( 'URL was not specified' );
	}

	// prevent form from submitting
	$( document ).on( 'submit', '#addInputFrm', function( e ) {
		e.preventDefault();
	});

	// set error notification
	if ( messages.length > 0 ) {

		// show notification
		app.__notification( 'error', messages.join( "\n\t" ) );

		return false;
	}

	// create item object
	var item = [{
		label	: $input.label.val,
		url		: $input.url.val
	}];

	// get current data and append to array
	app.request( function( results ) {

		var existing = results.items.urls !== undefined ? results.items.urls : undefined;

		// save object
		app.__save( existing, item, function() {

			// update list
			app.__update_list();

			// hide modal
			$( '#myModal' ).modal('hide')

			// notify of success
			app.__notification( 'success', 'Item saved' );
		});
	});

	return false;
};

app.request = function( cb_afterResponse ) {

	// get data from localStorage
	chrome.storage.local.get( 'items', function ( results ) {

		if ( results === undefined || results.items === undefined || results.items.urls.length === undefined || typeof results.items.urls !== 'object' ) {
			results = {
				items : {
					urls : []
				}
			};
		}

		// set app.$data object
		app.$data.items = results.items.urls;

		// callback after response complete
		if ( cb_afterResponse.length > -1 && typeof cb_afterResponse === 'function' ) {
			cb_afterResponse( results );
		}
		return results;
	});
};

app.init = function() {

	// init a few DOM elements
	app.$DOM.list = $( '#list' );

	// temp storage clearing
	//chrome.storage.local.clear();
	//chrome.storage.sync.clear();

	// request stored user data
	app.request( function( results ) {

		// create list
		app.__create_list( results.items.urls );

		// init listeners
		app.listeners();
	});
};

// add an event listener on DOM ready
document.addEventListener( 'DOMContentLoaded', function() {
	app.init();
});