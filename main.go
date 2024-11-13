package main

import (
	"os"
	"fmt"
	"regexp"
)

func digits(ccstr []byte) (ret []byte) {
	for _, s := range ccstr {
		if s >= '0' && s <= '9' {
			ret = append(ret, s)
		}
	}
	return
}

func repeats4(digits []byte) bool {
	if len(digits) < 1 {
		return false
	}

	var last byte = digits[0]
	var count uint = 1

	for _, s := range digits[1:] {
		if s == last {
			count++
		} else {
			count = 1
		}
		last = s
		if count > 3 {
			return true
		}
	}
	return false
}

func validcc(ccstr []byte) bool {
	hyphenated, _ := regexp.Match(`([0-9]{4}-){3}[0-9]{4}`, ccstr)
	digitsonly, _ := regexp.Match(`[0-9]{16}`, ccstr)

	if hyphenated || digitsonly {
		ccstr = digits(ccstr)
		if !(ccstr[0] == '4' || ccstr[0] == '5' || ccstr[0] == '6') {
			return false
		}
		if len(ccstr) != 16 {
			return false
		}
		if repeats4(ccstr) {
			return false
		}
	} else {
		return false
	}
	return true
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("pass the credit card number as the first argument")
		return 
	}

  fmt.Println(validcc([]byte(os.Args[1])))
}

