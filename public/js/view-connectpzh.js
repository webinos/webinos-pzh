$(document).ready(function () {
    $(".invitationLink").on("click", function(e){
        e.preventDefault();
        alert("Please use right click to copy this invitation address.");
        return false;
    });
    $(".socialInvite > a").on("click", function(e){
        var $this = $(this);
        var popup = $this.data("popup");
        if (/^\d+x\d+$/.test(popup)){
            popup = popup.split("x");
            window.open(this.href, "social", "width="+popup[0]+",height="+popup[1]+",scrollbars=yes");
            e.preventDefault();
        }
    });
    //Hack to hide the manual connectivity contents. Current lib that we use is limited
    //TODO: replace lib to be more flexible
    $(".toggleLink").text("Show");
    $(".toggle").hide();
});