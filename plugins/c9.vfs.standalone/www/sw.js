/*global clients, BroadcastChannel*/

this.onactivate = function() {
    clients.claim();
};

this.onmessage = function(event) {
    if (event.data == 'claim') {
        clients.claim();
    }
};
var root = new URL(this.registration.scope);
var updateCacheScheduled;
this.onfetch = function(event) {
    var url = new URL(event.request.url);
    if (url.href.startsWith(root.href)) {
        event.respondWith(
            caches.match(event.request).then(function(cachedResponse) {
                if (!updateCacheScheduled) updateCache();
                if (cachedResponse) return cachedResponse;

                return caches.open("ide").then(cache => {
                    return fetch(event.request).then(response => {
                        // Put a copy of the response in the runtime cache.
                        var req = new Request(url);
                        req.headers.set("etag", response.headers.get("etag"));
                        return cache.put(req, response.clone()).then(() => {
                            return response;
                        });
                    });
                });
            })
        );
    }
};

function updateCache() {
    updateCacheScheduled = setTimeout(function() {
        checkCache();
    }, 3000);
}


function checkCache() {
    var baseUrl = root.href;
    var ideCache;
    caches.open("ide").catch(function(e) {
        console.error(e);
    }).then(function(ideCache_) {
        ideCache = ideCache_;
        return ideCache ? ideCache.keys() : [];
    }).then(function(keys) {
        var val = keys.map(function(r) {
            var url = r.url;
            if (url.startsWith(baseUrl))
                url = url.slice(baseUrl.length);
            else if (/^\w+:/.test(url))
                return "";
            return r.headers.get("etag") + " " + url;
        }).join("\n") + "\n";
        if (val.length <= 1) {
            return ideCache;
        }
        return fetch(baseUrl + "__check__", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            },
            body: val
        }).then(function(response) {
             return response.text();
        }).then(function(value) {
            var parts = value.split("\n");
            var toDelete = [];
            for (var i = 0; i < parts.length; i++) {
                if (parts[i]) {
                    var del = ideCache.delete(baseUrl + parts[i]);
                    toDelete.push(del);
                }
            }
            return Promise.all(toDelete);
        });
    });
}

