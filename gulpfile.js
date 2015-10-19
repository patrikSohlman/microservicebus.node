var gulp = require('gulp');
var scp = require('gulp-scp2');

gulp.task('default', function () {
    return gulp.src('**/*')
    .pipe(scp({
        host: 'rpi22',
        username: 'root',
        password: 'pi',
        dest: '/home/root/microservicebus'
    }))
  .on('error', function (err) {
        console.log(err);
    })
    .on('success', function () {
        console.log('Done!');
    });
});