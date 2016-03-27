// For selecting our <data> tags
document.getDataElementByDataId = function(dataId) {
    var dataElements = document.getElementsByTagName('data')
    for (var i = 0; i < dataElements.length; i++) {
        if (dataElements[i].getAttribute('data-id') == dataId) {
            return dataElements[i]
        }
    }
}

// Wrapper for fetch() and XHR
window.request = function(url, callback, error) {
    if (window.fetch) {
        fetch(url).then(function(res) {
            if (res.status != 200) {
                console.error("Bad Request")
                error({
                    "text": res.statusText,
                    "code": res.status
                })
                return
            }
            res.text().then(function(data) {
                callback(data)
            })
        }).catch(function(err) {
            console.error("Fetch Error: " + err)
        })
    } else {
        // I fucking hate XHR so much...
        console.warn("If you're reading this, I don't know why the fuck you don't have a browser that supports fetch()")
        var xhr = new XMLHttpRequest()
        xhr.onload = function() {
            if (this.status != 200) {
                console.error("Bad Request")
                error({
                    "text": this.statusText,
                    "code": this.status
                })
                return
            }
            callback(this.responseText)
        }
        xhr.onerror = function(err) {
            error(err)
        }
        xhr.open('GET', url)
        xhr.send()
    }
}

// Get URL params
window.Location.prototype.getUrlParameter = function(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName

    for (var i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=')
        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1]
        }
    }
}

function initGallery() {
    var grid = document.querySelector('.image-grid')
    for (var i = 0; i < grid.children.length; i++) {
        grid.children[i].style.height = window.innerWidth * .2 + "px"
            // grid.children[i].children[1].style.height = grid.width * .1 + "px"
            /*if (grid.children[i].children[1].children[0].height > grid.children[i].children[1].children[0].width) {
                grid.children[i].children[1].children[0].style.width = "100%"
                grid.children[i].children[1].children[0].style.height = "auto"
            } else if (grid.children[i].children[1].children[0].width > grid.children[i].children[1].children[0].height) {
                grid.children[i].children[1].children[0].style.width = "auto"
                grid.children[i].children[1].children[0].style.height = "100%"
            }*/
    }
}
