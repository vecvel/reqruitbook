package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

var loadOnce sync.Once

// LoadDotEnv reads a `.env` file into the process environment for local runs.
//
// Variables already present in the environment always win, so a container or CI
// runner that sets real values is never overridden by a developer's file. In
// production there is no `.env` and this is a no-op.
func LoadDotEnv() {
	loadOnce.Do(func() {
		path, found := findDotEnv()
		if !found {
			return
		}

		file, err := os.Open(path)
		if err != nil {
			return
		}
		defer func() { _ = file.Close() }()

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}

			key, value, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}

			key = strings.TrimSpace(strings.TrimPrefix(key, "export "))
			value = strings.TrimSpace(value)
			value = strings.Trim(value, `"'`)

			if key == "" {
				continue
			}
			if _, alreadySet := os.LookupEnv(key); alreadySet {
				continue
			}

			_ = os.Setenv(key, value)
		}
	})
}

// findDotEnv walks up from the working directory so a service started from its
// own folder still finds the repository's file.
func findDotEnv() (string, bool) {
	dir, err := os.Getwd()
	if err != nil {
		return "", false
	}

	for i := 0; i < 6; i++ {
		candidate := filepath.Join(dir, ".env")
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, true
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "", false
}
