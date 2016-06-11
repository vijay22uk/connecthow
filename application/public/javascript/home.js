
$(document).ready(function(){
	$('body').addClass('home');
	 $('form').submit(function(){
	var email = $('#email').val();
	var room = $('#classroom').val();
	var _location = "/classroom/" +room + "/" +email
    location.href = _location;
	return false;
  });
})

