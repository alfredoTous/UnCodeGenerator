document.getElementById('generateBtn').addEventListener('click', function () {
    const umlInput = document.getElementById('umlInput').value;
    const classData = extractClasses(umlInput);
    console.log(classData);
    const classListElement = document.getElementById('classList');
    classListElement.innerHTML = '';
    classData.forEach(classItem => {
        const listItem = document.createElement('li'); 
        listItem.style.border = "3px solid #ccc"; 
        listItem.style.margin = "10px";
        listItem.style.padding = "10px";
        if (classItem.type === "class") {
            listItem.textContent = generateJavaClass(
                classItem.className,
                classItem.attributes,
                classItem.methods,
                classItem.isAbstract,
                classItem.extends
            );
        } else if (classItem.type === "enum") {
            listItem.textContent = generateEnum(classItem.enumName, classItem.values);
        }
    
        classListElement.appendChild(listItem);
    });
    
});

function extractClasses(umlText) {
    const classPattern = /class\s+([a-zA-Z0-9_]+)(?:\s+extends\s+([a-zA-Z0-9_]+))?\s*{([^}]*)}/g;
    const enumPattern = /enum\s+([a-zA-Z0-9_]+)\s*{([^}]*)}/g;

    const abstractClasses = extractAbstractClasses(umlText);

    let classData = [];
    let match;

    while ((match = classPattern.exec(umlText)) !== null) {
        const className = match[1];
        const parentClass = match[2] || null; 
        const attributeBlock = match[3];

        const { attributes, methods } = extractAttributesAndMethods(attributeBlock, className);
        classData.push({
            type: "class",
            isAbstract: !!abstractClasses[className],
            className,
            extends: parentClass,
            attributes: attributes || [],
            methods: methods || []
        });
    }
    const relations = extractRelations(umlText);
    const processedRelations = processRelations(relations);
    const relationsInAttr = assignAttrToClassesFromRel(processedRelations,classData);
    classData = relationsInAttr;
    const enums = extractEnums(umlText, enumPattern);
    classData = classData.concat(enums);

    return classData;
}

function extractAttributesAndMethods(block, className) {
    const lines = block.split('\n').map(line => line.trim());
    const attributes = [];
    const methods = [];

    lines.forEach(line => {
        if (/^([\+\-\#]?)\s*(?:void|[a-zA-Z0-9_]+)?\s*([a-zA-Z0-9_]+)\(([^)]*)\)$/.test(line)) {
            const match = line.match(/^([\+\-\#]?)\s*(?:([a-zA-Z0-9_]+)\s+)?([a-zA-Z0-9_]+)\(([^)]*)\)$/);

            if(match[3] == className){
                methods.push({
                    visibility: match[1] || '+',
                    returnType: "", 
                    name: match[3],
                    parameters: match[4] || ''
                })
            } else {
            methods.push({
                visibility: match[1] || '+',
                returnType: match[2] || 'void',
                name: match[3],
                parameters: match[4] || ''
            });}
        } else if (/^([\+\-\#]?)\s*([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)$/.test(line)) {
            const match = line.match(/^([\+\-\#]?)\s*([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)$/); 
            attributes.push({
                visibility: match[1] || '+',
                type: match[2],
                name: match[3]
            });
        } 
    });

    return { attributes, methods };
}

function generateJavaClass(className, attributes, methods, isAbstract, extendsClass) {

    const classDeclaration = `${isAbstract ? 'abstract ' : ''}class ${className}${extendsClass ? ` extends ${extendsClass}` : ''}`;

    const attributesCode = attributes
        .map(attr => `    ${translateVisibility(attr.visibility)} ${attr.type} ${attr.name};`)
        .join('\n');
        
    const methodsCode = methods
        .map(method => `    ${translateVisibility(method.visibility)} ${method.returnType} ${method.name}(${method.parameters}) {}`)
        .join('\n');

        return `
        public ${classDeclaration} {
        ${attributesCode ? `\n${attributesCode}\n` : ''}
        ${methodsCode ? `\n${methodsCode}\n` : ''}
        }
        `.trim();
        }

function generateEnum(enumName, values) {
    return `
public enum ${enumName} {
    ${values}
}
`.trim();
}

function extractEnums(umlText, enumPattern){
    const enums = [];
    let match;
    while((match = enumPattern.exec(umlText)) !== null){
        const enumName = match[1];
        const values = match[2];  
        
        enums.push({
            type: "enum",
            enumName,
            values
        });
    }

    return enums;

}

function extractAbstractClasses(umlText) {
    const abstractPattern = /abstract\s+class\s+([a-zA-Z0-9_]+)/g;
    const abstractClasses = {};

    let match;
    while ((match = abstractPattern.exec(umlText)) !== null) {
        const className = match[1];
        abstractClasses[className] = true; 
    }

    return abstractClasses; 
}

function extractRelations(umlText) {
    const relationshipPattern = /(\w+)\s*(["\s]*(\*|1)?["\s]*)?(-->|--|<--)\s*(["\s]*(\*|1)?["\s]*)?(\w+)/g;
    const relations = [];
    let match;

    while ((match = relationshipPattern.exec(umlText)) !== null) {
        const from = match[4] === "<--" ? match[7] : match[1];
        const to = match[4] === "<--" ? match[1] : match[7];
        const cardinalityFrom = match[4] === "<--" ? match[6] || null : match[3] || null;
        const cardinalityTo = match[4] === "<--" ? match[3] || null : match[6] || null;

        relations.push({
            from: from, 
            cardinalityFrom: cardinalityFrom, 
            type: match[4], 
            cardinalityTo: cardinalityTo, 
            to: to 
        });
    }
    return relations;
}

function processRelations(relations){
    const classAttFromRelations = {};

    relations.forEach(relation => {
        if (!classAttFromRelations[relation.from]) {
            classAttFromRelations[relation.from] = [];
        }
        if (!classAttFromRelations[relation.to]) {
            classAttFromRelations[relation.to] = [];
        }
        if (relation.type === "--") {
            classAttFromRelations[relation.from].push({
                type: relation.to,
                cardinality: relation.cardinalityTo,
            });

            classAttFromRelations[relation.to].push({
                type: relation.from,
                cardinality: relation.cardinalityFrom,
            });
        } else {
            classAttFromRelations[relation.from].push({
                type: relation.to,
                cardinality: relation.cardinalityTo,
            });
        }
    });

    return classAttFromRelations;
}

function assignAttrToClassesFromRel(classAttFromRelations, classData) {
    classData.forEach(classItem => {
        const className = classItem.className;
        if (classAttFromRelations[className]) {
            classAttFromRelations[className].forEach(attr => {
                classItem.attributes.push({
                    visibility: "+", 
                    type: attr.cardinality === "*" ? `${attr.type}[]` : attr.type,
                    name: attr.type
                });
            });
        }
    });
    return classData;
}


function translateVisibility(visibilitySymbol) {
    switch (visibilitySymbol) {
        case '+':
            return 'public';
        case '-':
            return 'private';
        case '#':
            return 'protected';
        default:
            return 'private';
    }
}
