#AWS Helper Scripts

##`delete-log-groups.sh`

**Usage:**

Deletes CloudWatch Log Groups by prefix. For example:

```
./delete-log-groups.sh --prefix="/aws/lambda"
```

##`git-status.sh`

**Usage:**

Run `git status` in each subdirectory of the current directory. Useful when you store all of your git repos in one folder. Place in root of source code folder and run as desired.

```
./git-status.sh
```

##`osx-flush-dns-cache.sh`

**Usage:**

Flush DNS cache on MAC OS X

```
sudo ./os-flush-dns-cache.sh
```
