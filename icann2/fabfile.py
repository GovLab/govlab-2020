from __future__ import with_statement
from fabric.api import *

env.hosts = ['thegovlab.org']
env.user = "ubuntu"
env.key_filename = ["/Users/claudioccm/Trampos/code/repos/icann-2/GovLabWikiKey.pem",]

def push():
    local("git push -f server master")

def pull_on_server():
    with cd("/var/www/wordpress/wp-content/themes/hustle/icann"):
        sudo("git pull --rebase origin master", user="www-data")

def deploy():
    push()
    pull_on_server()
