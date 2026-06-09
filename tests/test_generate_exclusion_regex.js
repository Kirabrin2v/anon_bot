function generate_exclusion_regex(keyword, exclusions) {
        let behind_parts = new Set();
        let ahead_parts = new Set();
        for (const exclusion of exclusions) {
            let [behind_part, ...ahead_part] = exclusion.split(keyword)
            ahead_part = ahead_part.join("")
            
            behind_parts.add(behind_part)
            ahead_parts.add(ahead_part)
        }
        behind_parts.delete("")
        ahead_parts.delete("")
        behind_parts = Array.from(behind_parts)
        ahead_parts = Array.from(ahead_parts)
        const behind_condition = `(?<!${behind_parts.join("|")})`
        const ahead_condition = `(?!${ahead_parts.join("|")})`
        const regex = behind_condition + keyword + ahead_condition

        return regex
    }


const KEYWORD = 'лайт'
const EXCLUSIONS = ['делайте', 'лайте']

console.log(generate_exclusion_regex(KEYWORD, EXCLUSIONS))