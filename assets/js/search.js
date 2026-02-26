(function() {
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  if (!input || !results) return;

  var posts = [];
  fetch('/search.json')
    .then(function(r) { return r.json(); })
    .then(function(data) { posts = data; });

  input.addEventListener('input', function() {
    var query = this.value.toLowerCase().trim();
    results.innerHTML = '';
    if (!query) return;
    posts.forEach(function(post) {
      if (post.title.toLowerCase().indexOf(query) !== -1 ||
          post.content.toLowerCase().indexOf(query) !== -1 ||
          (post.tags && post.tags.join(' ').toLowerCase().indexOf(query) !== -1)) {
        var li = document.createElement('li');
        li.innerHTML = '<a href="' + post.url + '">' + post.title + '</a>' +
                       '<br><span class="search-date">' + post.date + '</span>';
        results.appendChild(li);
      }
    });
  });
})();
