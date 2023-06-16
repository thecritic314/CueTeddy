var checkboxes = document.getElementsByClassName("on-click");
var checkbox = checkboxes[0];

var billings = document.getElementsByClassName("billing");
var billing = billings[0];

checkbox.addEventListener("click", function (e) {
    billing.classList.toggle("invis");
})