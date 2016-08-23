(function () {
    'use strict';
    $(document).ready(documentReadyCallback);
    function documentReadyCallback() {
        $('body').removeClass("isloading");
        $(".loader").fadeOut("slow");
        var userName = getParameterByName('user');
        if (userName) {
            getTopScreenShots(userName, 10);
        } else {
            var name = prompt("Your name was ?", new Date().toDateString());
            if (name != null) {
                getTopScreenShots(name, 10);
            }
        }


    }
    function getTopScreenShots(name, limit) {
        $.ajax({
            url: "/tasks/getScreenShot/" + name + "/" + limit,
            method: "GET",
            success: function (data) {
                loadImages(data);
                toastr.success("Screen-shots loaded");
            },
            error: function (err) {
                debugger
                toastr.error('Unable to get screen-shots');
            }
        })
    }
    function loadImages(data) {
        for (var i = 0; i < data.length; i++) {
            var elem = document.createElement("img");
            debugger
            elem.src = data[i].dataURL;
            elem.setAttribute("height", "300px");
            elem.setAttribute("width", "300px");
            elem.setAttribute("alt", "ScreenShot -" + data[i].name);
            document.getElementById("myscreens").appendChild(elem);
        }


    }
    function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

})();