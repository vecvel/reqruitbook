package auth

import (
	"strings"
	"testing"
)

func TestHashAndVerifyPassword(t *testing.T) {
	const password = "Correct-Horse-Battery-9"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf("hash is not argon2id: %q", hash)
	}
	// The plaintext must not survive anywhere in the encoded hash.
	if strings.Contains(hash, password) {
		t.Fatal("hash contains the plaintext password")
	}

	if err := VerifyPassword(password, hash); err != nil {
		t.Errorf("correct password rejected: %v", err)
	}
	if err := VerifyPassword("wrong-password", hash); err == nil {
		t.Error("incorrect password accepted")
	}
}

// Equal passwords must produce different hashes, or a stolen table would reveal
// which accounts share a password.
func TestHashesAreSalted(t *testing.T) {
	first, _ := HashPassword("Correct-Horse-Battery-9")
	second, _ := HashPassword("Correct-Horse-Battery-9")

	if first == second {
		t.Fatal("two hashes of the same password are identical; salting is broken")
	}
}

func TestVerifyRejectsMalformedHashes(t *testing.T) {
	for _, hash := range []string{"", "not-a-hash", "$argon2id$broken", "$bcrypt$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA"} {
		if err := VerifyPassword("anything", hash); err == nil {
			t.Errorf("malformed hash %q was accepted", hash)
		}
	}
}

func TestPasswordPolicy(t *testing.T) {
	policy := DefaultPasswordPolicy()

	if problems := policy.Validate("Str0ngEnoughPassword"); len(problems) != 0 {
		t.Errorf("valid password rejected: %v", problems)
	}
	if problems := policy.Validate("short1A"); len(problems) == 0 {
		t.Error("short password accepted")
	}
	if problems := policy.Validate("alllowercase123"); len(problems) == 0 {
		t.Error("password without an uppercase letter accepted")
	}
	if problems := policy.Validate("NoDigitsInHereAtAll"); len(problems) == 0 {
		t.Error("password without a digit accepted")
	}
}

// Sign-in compares against this when the email is unknown, so it must be a real
// hash — otherwise the comparison returns instantly and leaks the difference.
func TestDummyHashIsUsable(t *testing.T) {
	if DummyHash == "" {
		t.Fatal("DummyHash is empty")
	}
	if err := VerifyPassword("anything", DummyHash); err == nil {
		t.Error("DummyHash should not match an arbitrary password")
	}
}
