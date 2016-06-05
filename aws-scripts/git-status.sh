#!/bin/bash
# Run "git status" in each subdirectory of the current directory.
# Useful when you store all of your git repos in one folder.
# Place in root of source code folder and run as desired.
clear

for dir in ./*; # For every item in the folder:
	do (
		if [ -d "$dir" ]; # If it is a directory:
			then (
				# cd into and run git status
				# The codes color the $dir for easier reading
				echo -e "\x1B[40;38;5;82m$dir\x1B[0m" \
					&& cd "$dir" && git status
				echo # Toss in a new line for readability.
			);
		fi
	);
done
