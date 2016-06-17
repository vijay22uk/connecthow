
if (window.location.protocol != "https:" && location.port !=="8080")
    window.location.href = "https:" + window.location.href.substring(window.location.protocol.length);


$(document).ready(function () {
	$('body').removeClass("isloading");
	$(".loader").fadeOut("slow");
	$('body').addClass('home');
	$('form').submit(function () {
		var email = $('#email').val();
		var room = $('#classroom').val().toLowerCase();
		var _location = "/classroom/" + room + "/" + email
		location.href = _location;
		return false;
	});
})

