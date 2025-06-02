const client=  new DirectusSDK({
  url: "https://directus.theburnescenter.org/",
  project: "thegovlab",
  storage: window.localStorage
})

client.getItems(
  'blog', {
    limit: 3,
    sort:"-original_date",
    fields: ['*.*','authors.team_id.*','authors.team_id.picture.*','related_posts.incoming_blog_id.*','related_publications.pub_id.*','related_publications.pub_id.picture.*','related_projects.projects_id.*','related_projects.projects_id.main_picture.*']
  }).then(data => {
    render(data.data);
    // console.log(data);
})
.catch(error => console.error(error));