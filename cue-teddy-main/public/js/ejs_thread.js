var deleteReply = document.getElementsByClassName("are-you-sure-reply");
var deleteThread = document.getElementsByClassName("are-you-sure-thread");

console.log(deleteReply.length);

for (var i = 0; i < deleteReply.length; i++) {
    deleteReply[i].addEventListener("click", function (e) {
        if (!confirm("Are you sure you want to delete this reply? This cannot be undone.")) {
            e.preventDefault();
        }
    })
}

for (var i = 0; i < deleteThread.length; i++) {
    deleteThread[i].addEventListener("click", function (e) {
        if (!confirm("Are you sure you want to delete this thread? This cannot be undone.")) {
            e.preventDefault();
        }
    })
}





