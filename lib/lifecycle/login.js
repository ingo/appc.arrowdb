var ArrowDB = require('arrowdb');

/**
 * login is called only if loginRequired calls next with the args (null, true). It looks at the current req, and
 * either logs the user in (based on credentials provided in headers) or returns an error. It can return a session
 * token via a res header so that future requests don't have to provide credentials.
 */
exports.login = function login(request, response, next) {
	var self = this,
		headers = request.headers || {},
		opts = this.getOpts(),
		key = this.getKey(),
		username = headers.user,
		password = headers.pass;

	// login to get the user and make sure this session is valid
	// but only do it once for a session
	if (this.db && !username && !password && !request.cookies.arrowdbuid) {
		if (this.db.arrowdbuid) {
			// we already have it
			return next();
		}
		return this.db.usersShowMe(function (err, result) {
			if (err) {
				self.db = null;
				return next('Authentication is required. Invalid or expired sessionCookieString header passed.');
			}
			self.user = result && result.body && result.body.response && result.body.response.users && result.body.response.users[0];
			if (self.user) {
				var setCookie = response.cookie;
				self.db.arrowdbuid = self.user.id;
				if (setCookie) {
					// make sure we haven't already sent the response
					var sent = response.headersSent === undefined ? response.response && response.response.headersSent : response.headersSent;
					if (!sent) {
						setCookie = setCookie.bind(response.response || response);
						setCookie('arrowdbuid', self.user.id);
					}
				}
			} else {
				return next('Authentication is required. Invalid login');
			}
			next();
		});
	}

	if (!username || !password) {
		if (this.config.requireSessionLogin) {
			return next('Authentication is required. Please pass these headers: user, and pass; or sessionCookieString.');
		}
		else {
			return next();
		}
	}

	this.db = this.baseContext.db = new ArrowDB(key, opts);
	this.db.usersLogin({
		login: username,
		password: password
	}, function loginCallback(err, result) {
		if (err) {
			self.db = self.baseContext.db = null;
			return next(err);
		}

		this.user = self.baseContext.user = result.body.response.users[0];
		response.header('sessionCookieString', result.cookieString);
		self.db.sessionCookieString = self.baseContext.db.sessionCookieString = result.cookieString;
		return next();
	});
};